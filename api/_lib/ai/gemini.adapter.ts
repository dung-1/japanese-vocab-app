import type {
  AiChatGatewayRequest,
  AiGatewayError,
  AiGatewayStreamEvent,
  AiModelCapabilities,
  AiProviderAdapter,
} from './contracts.ts';

type FetchLike = typeof fetch;

interface GeminiErrorPayload {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

interface GeminiStreamChunk {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_TIMEOUT_MS = 55_000;

/**
 * Google Gemini REST adapter.
 *
 * API credentials are read only from the server environment. The fetch
 * dependency is injectable so tests can run without network access or secrets.
 */
export class GeminiProviderAdapter implements AiProviderAdapter {
  readonly id = 'gemini' as const;

  private readonly apiKey: string | undefined;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(
    apiKey: string | undefined = process.env['GEMINI_API_KEY'],
    fetchImpl: FetchLike = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  getCapabilities(_model: string): AiModelCapabilities {
    // Vision remains disabled until image forwarding and payload limits have
    // been implemented and verified end-to-end in the dedicated vision phase.
    return { text: true, vision: false, streaming: true };
  }

  async *generate(
    request: AiChatGatewayRequest,
    signal: AbortSignal,
  ): AsyncIterable<AiGatewayStreamEvent> {
    if (!this.apiKey?.trim()) {
      yield {
        type: 'error',
        error: {
          code: 'provider_not_configured',
          message: 'Gemini is not configured on the server.',
          retryable: false,
          provider: this.id,
        },
      };
      return;
    }

    if (request.images?.length) {
      yield {
        type: 'error',
        error: {
          code: 'unsupported_capability',
          message: 'Image input is not enabled for Gemini until the vision phase is complete.',
          retryable: false,
          provider: this.id,
        },
      };
      return;
    }

    const model = encodeURIComponent(request.model);
    const url = `${GEMINI_API_BASE}/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`;
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    const combinedSignal = AbortSignal.any([signal, timeoutSignal]);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          ...(request.system
            ? { systemInstruction: { parts: [{ text: request.system }] } }
            : {}),
          contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
          generationConfig: {
            ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
            ...(request.topK !== undefined ? { topK: request.topK } : {}),
          },
        }),
        signal: combinedSignal,
      });
    } catch (error) {
      if (signal.aborted) return;
      const timedOut = timeoutSignal.aborted;
      yield {
        type: 'error',
        error: {
          code: timedOut ? 'upstream_timeout' : 'provider_unavailable',
          message: timedOut ? 'Gemini request timed out.' : 'Could not connect to Gemini.',
          retryable: true,
          provider: this.id,
        },
      };
      return;
    }

    if (!response.ok) {
      const error = await readGeminiError(response);
      yield { type: 'error', error };
      return;
    }

    if (!response.body) {
      yield {
        type: 'error',
        error: {
          code: 'provider_unavailable',
          message: 'Gemini returned an empty streaming response.',
          retryable: true,
          provider: this.id,
        },
      };
      return;
    }

    try {
      for await (const event of parseSse(response.body, signal)) {
        if (event.type === 'token') yield event;
        else if (event.type === 'error') {
          yield { type: 'error', error: event.error };
          return;
        }
      }
      if (!signal.aborted) yield { type: 'done' };
    } catch {
      if (!signal.aborted) {
        yield {
          type: 'error',
          error: {
            code: 'provider_unavailable',
            message: 'Gemini stream ended unexpectedly.',
            retryable: true,
            provider: this.id,
          },
        };
      }
    }
  }
}

async function readGeminiError(response: Response): Promise<AiGatewayError> {
  let message = `Gemini returned HTTP ${response.status}.`;
  try {
    const payload = await response.json() as GeminiErrorPayload;
    if (typeof payload.error?.message === 'string') {
      // Do not include request URLs or credentials in logs or public messages.
      message = payload.error.message.slice(0, 500);
    }
  } catch {
    // Keep the status-only message when upstream did not return JSON.
  }

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after'));
    return {
      code: 'rate_limited',
      message: 'Gemini rate limit reached. Try again later.',
      retryable: true,
      provider: 'gemini',
      ...(Number.isFinite(retryAfter) && retryAfter > 0
        ? { retryAfterSeconds: Math.min(retryAfter, 3600) }
        : {}),
    };
  }

  if (response.status >= 500) {
    return {
      code: 'provider_unavailable',
      message: 'Gemini is temporarily unavailable.',
      retryable: true,
      provider: 'gemini',
    };
  }

  return {
    code: 'provider_rejected',
    message,
    retryable: false,
    provider: 'gemini',
  };
}

async function* parseSse(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<AiGatewayStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame
          .split('\n')
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trim())
          .join('\n');

        if (data && data !== '[DONE]') {
          let chunk: GeminiStreamChunk;
          try {
            chunk = JSON.parse(data) as GeminiStreamChunk;
          } catch {
            yield {
              type: 'error',
              error: {
                code: 'provider_unavailable',
                message: 'Gemini returned malformed streaming data.',
                retryable: false,
                provider: 'gemini',
              },
            };
            return;
          }

          for (const candidate of chunk.candidates ?? []) {
            for (const part of candidate.content?.parts ?? []) {
              if (typeof part.text === 'string' && part.text.length) {
                yield { type: 'token', token: part.text };
              }
            }
          }
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    if (signal.aborted) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
