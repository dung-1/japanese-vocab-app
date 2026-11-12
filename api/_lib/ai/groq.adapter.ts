import type {
  AiChatGatewayRequest,
  AiGatewayError,
  AiGatewayStreamEvent,
  AiModelCapabilities,
  AiProviderAdapter,
} from './contracts.js';

type FetchLike = typeof fetch;

interface GroqErrorPayload {
  error?: { message?: string; type?: string; code?: string };
}

interface GroqStreamChunk {
  choices?: Array<{
    delta?: { content?: string | Array<{ type?: string; text?: string }> };
    finish_reason?: string | null;
  }>;
}

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 55_000;

/** Server-side Groq adapter using the OpenAI-compatible Chat Completions API. */
export class GroqProviderAdapter implements AiProviderAdapter {
  readonly id = 'groq' as const;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(
    apiKey: string | undefined = process.env['GROQ_API_KEY'],
    fetchImpl: FetchLike = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  getCapabilities(_model: string): AiModelCapabilities {
    // Vision is deliberately disabled until the dedicated multimodal phase.
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
          message: 'Groq is not configured on the server.',
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
          message: 'Image input is not enabled for Groq until the vision phase is complete.',
          retryable: false,
          provider: this.id,
        },
      };
      return;
    }

    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    const combinedSignal = AbortSignal.any([signal, timeoutSignal]);
    let response: Response;

    try {
      response = await this.fetchImpl(GROQ_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          model: request.model,
          messages: [
            ...(request.system ? [{ role: 'system', content: request.system }] : []),
            { role: 'user', content: request.prompt },
          ],
          stream: true,
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(request.topK !== undefined ? { top_k: request.topK } : {}),
        }),
        signal: combinedSignal,
      });
    } catch {
      if (signal.aborted) return;
      yield {
        type: 'error',
        error: {
          code: timeoutSignal.aborted ? 'upstream_timeout' : 'provider_unavailable',
          message: timeoutSignal.aborted ? 'Groq request timed out.' : 'Could not connect to Groq.',
          retryable: true,
          provider: this.id,
        },
      };
      return;
    }

    if (!response.ok) {
      yield { type: 'error', error: await readGroqError(response) };
      return;
    }

    if (!response.body) {
      yield {
        type: 'error',
        error: {
          code: 'provider_unavailable',
          message: 'Groq returned an empty streaming response.',
          retryable: true,
          provider: this.id,
        },
      };
      return;
    }

    try {
      for await (const event of parseGroqSse(response.body, signal)) {
        if (event.type === 'token') yield event;
        else if (event.type === 'error') {
          yield event;
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
            message: 'Groq stream ended unexpectedly.',
            retryable: true,
            provider: this.id,
          },
        };
      }
    }
  }
}

async function readGroqError(response: Response): Promise<AiGatewayError> {
  let upstreamMessage = '';
  try {
    const payload = await response.json() as GroqErrorPayload;
    if (typeof payload.error?.message === 'string') {
      upstreamMessage = payload.error.message.slice(0, 300);
    }
  } catch {
    // Use status-based public message when upstream body is not JSON.
  }

  if (response.status === 429) {
    const rawRetryAfter = Number(response.headers.get('retry-after'));
    return {
      code: 'rate_limited',
      message: 'Groq rate limit reached. Try again later.',
      retryable: true,
      provider: 'groq',
      ...(Number.isFinite(rawRetryAfter) && rawRetryAfter > 0
        ? { retryAfterSeconds: Math.min(rawRetryAfter, 3600) }
        : {}),
    };
  }

  if (response.status >= 500) {
    return {
      code: 'provider_unavailable',
      message: 'Groq is temporarily unavailable.',
      retryable: true,
      provider: 'groq',
    };
  }

  return {
    code: 'provider_rejected',
    message: upstreamMessage || `Groq rejected the request (HTTP ${response.status}).`,
    retryable: false,
    provider: 'groq',
  };
}

async function* parseGroqSse(
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

        if (data === '[DONE]') return;
        if (data) {
          let chunk: GroqStreamChunk;
          try {
            chunk = JSON.parse(data) as GroqStreamChunk;
          } catch {
            yield {
              type: 'error',
              error: {
                code: 'provider_unavailable',
                message: 'Groq returned malformed streaming data.',
                retryable: false,
                provider: 'groq',
              },
            };
            return;
          }

          for (const choice of chunk.choices ?? []) {
            const content = choice.delta?.content;
            if (typeof content === 'string' && content.length) {
              yield { type: 'token', token: content };
            } else if (Array.isArray(content)) {
              for (const part of content) {
                if (typeof part.text === 'string' && part.text.length) {
                  yield { type: 'token', token: part.text };
                }
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
