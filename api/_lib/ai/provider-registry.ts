import type {
  AiChatGatewayRequest,
  AiGatewayError,
  AiGatewayStreamEvent,
  AiProviderAdapter,
} from './contracts.js';

export interface AiFallbackPolicy {
  /** Explicit ordered candidates. The requested provider is always attempted first. */
  fallbackOrder: Partial<Record<'gemini' | 'groq', Array<'gemini' | 'groq'>>>;
}

export interface AiProviderRegistry {
  get(provider: 'gemini' | 'groq'): AiProviderAdapter | undefined;
}

export class StaticAiProviderRegistry implements AiProviderRegistry {
  private readonly adapters: Map<'gemini' | 'groq', AiProviderAdapter>;

  constructor(adapters: AiProviderAdapter[]) {
    this.adapters = new Map();
    for (const adapter of adapters) {
      if (adapter.id === 'local') continue;
      this.adapters.set(adapter.id, adapter);
    }
  }

  get(provider: 'gemini' | 'groq'): AiProviderAdapter | undefined {
    return this.adapters.get(provider);
  }
}

const FALLBACK_ELIGIBLE_CODES = new Set<AiGatewayError['code']>([
  'rate_limited',
  'provider_unavailable',
  'upstream_timeout',
]);

/**
 * Attempts the selected provider and, only before any token is emitted,
 * may move to explicitly configured fallback candidates.
 *
 * It never retries auth/configuration, invalid input, unsupported capability,
 * client cancellation, or a stream that has already emitted partial output.
 */
export async function* generateWithFallback(
  request: AiChatGatewayRequest,
  signal: AbortSignal,
  registry: AiProviderRegistry,
  policy: AiFallbackPolicy,
): AsyncGenerator<AiGatewayStreamEvent> {
  const order: Array<'gemini' | 'groq'> = [
    request.provider as 'gemini' | 'groq',
    ...(policy.fallbackOrder[request.provider as 'gemini' | 'groq'] ?? []),
  ];
  const candidates = [...new Set(order)];

  let lastError: AiGatewayError | undefined;

  for (const providerId of candidates) {
    if (signal.aborted) return;

    const adapter = registry.get(providerId);
    if (!adapter) {
      lastError = {
        code: 'provider_not_configured',
        message: `${providerId} provider is not available on the server.`,
        retryable: false,
        provider: providerId,
      };
      // Missing fallback candidate is skipped, but a missing primary is terminal.
      if (providerId === request.provider) {
        yield { type: 'error', error: lastError };
        return;
      }
      continue;
    }

    const capabilities = adapter.getCapabilities(request.model);
    if (!capabilities.text || (request.images?.length && !capabilities.vision)) {
      lastError = {
        code: 'unsupported_capability',
        message: `${providerId} does not support the requested input capability.`,
        retryable: false,
        provider: providerId,
      };
      if (providerId === request.provider) {
        yield { type: 'error', error: lastError };
        return;
      }
      continue;
    }

    let emittedToken = false;
    let completed = false;
    let providerError: AiGatewayError | undefined;

    try {
      for await (const event of adapter.generate(
        { ...request, provider: providerId },
        signal,
      )) {
        if (signal.aborted) return;

        if (event.type === 'token') {
          emittedToken = true;
          yield event;
        } else if (event.type === 'done') {
          completed = true;
          yield event;
          return;
        } else {
          providerError = { ...event.error, provider: event.error.provider ?? providerId };
          break;
        }
      }
    } catch {
      providerError = {
        code: 'provider_unavailable',
        message: `${providerId} stream failed unexpectedly.`,
        retryable: true,
        provider: providerId,
      };
    }

    if (signal.aborted) return;

    if (!providerError && !completed) {
      providerError = {
        code: 'provider_unavailable',
        message: `${providerId} stream ended without a completion event.`,
        retryable: true,
        provider: providerId,
      };
    }

    if (!providerError) return;
    lastError = providerError;

    if (emittedToken || !FALLBACK_ELIGIBLE_CODES.has(providerError.code)) {
      yield { type: 'error', error: providerError };
      return;
    }

    // Only retry explicitly classified transient failures, before first token.
  }

  if (!signal.aborted && lastError) {
    yield { type: 'error', error: lastError };
  } else if (!signal.aborted) {
    yield {
      type: 'error',
      error: {
        code: 'provider_unavailable',
        message: 'No configured AI provider could handle this request.',
        retryable: true,
      },
    };
  }
}
