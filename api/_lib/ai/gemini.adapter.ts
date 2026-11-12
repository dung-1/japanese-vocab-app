import type {
  AiChatGatewayRequest, AiGatewayError, AiGatewayStreamEvent,
  AiModelCapabilities, AiProviderAdapter,
} from './contracts.js';
type FetchLike = typeof fetch;
interface GeminiInteractionResponse {
  output_text?: string;
  output?: Array<{ text?: string; content?: Array<{ type?: string; text?: string }> }>;
  error?: { code?: number; message?: string; status?: string };
}
const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const DEFAULT_TIMEOUT_MS = 50_000;
export class GeminiProviderAdapter implements AiProviderAdapter {
  readonly id = 'gemini' as const;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  constructor(apiKey: string | undefined = process.env['GEMINI_API_KEY'], fetchImpl: FetchLike = fetch, timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.apiKey = apiKey; this.fetchImpl = fetchImpl; this.timeoutMs = timeoutMs;
  }
  getCapabilities(_model: string): AiModelCapabilities { return { text: true, vision: false, streaming: true }; }
  async *generate(request: AiChatGatewayRequest, signal: AbortSignal): AsyncIterable<AiGatewayStreamEvent> {
    if (!this.apiKey?.trim()) {
      yield { type: 'error', error: { code: 'provider_not_configured', message: 'Gemini is not configured on the server.', retryable: false, provider: this.id } }; return;
    }
    if (request.images?.length) {
      yield { type: 'error', error: { code: 'unsupported_capability', message: 'Image input is not enabled for Gemini yet.', retryable: false, provider: this.id } }; return;
    }
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    const combinedSignal = AbortSignal.any([signal, timeoutSignal]);
    const input = request.system ? request.system + '\n\n' + request.prompt : request.prompt;
    let response: Response;
    try {
      response = await this.fetchImpl(GEMINI_INTERACTIONS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({ model: request.model, input, generation_config: { thinking_level: 'low' } }),
        signal: combinedSignal,
      });
    } catch {
      if (signal.aborted) return;
      const timedOut = timeoutSignal.aborted;
      yield { type: 'error', error: { code: timedOut ? 'upstream_timeout' : 'provider_unavailable',
        message: timedOut ? 'Gemini exceeded the 50-second response limit. Try a shorter prompt or retry.' : 'Could not connect to Gemini.',
        retryable: true, provider: this.id } }; return;
    }
    if (!response.ok) { yield { type: 'error', error: await readGeminiError(response) }; return; }
    let payload: GeminiInteractionResponse;
    try { payload = await response.json() as GeminiInteractionResponse; }
    catch {
      if (signal.aborted) return;
      yield { type: 'error', error: { code: timeoutSignal.aborted ? 'upstream_timeout' : 'provider_unavailable',
        message: timeoutSignal.aborted ? 'Gemini response timed out while reading the response.' : 'Gemini returned an invalid response.',
        retryable: true, provider: this.id } }; return;
    }
    const output = extractOutputText(payload);
    if (!output) {
      yield { type: 'error', error: { code: 'provider_unavailable', message: 'Gemini completed without returning text. Please retry.', retryable: true, provider: this.id } }; return;
    }
    if (!signal.aborted) { yield { type: 'token', token: output }; yield { type: 'done' }; }
  }
}
function extractOutputText(payload: GeminiInteractionResponse): string {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text;
  const parts: string[] = [];
  for (const item of payload.output ?? []) {
    if (typeof item.text === 'string') parts.push(item.text);
    for (const content of item.content ?? []) if (content.type === 'text' && typeof content.text === 'string') parts.push(content.text);
  }
  return parts.join('');
}
async function readGeminiError(response: Response): Promise<AiGatewayError> {
  let message = 'Gemini returned HTTP ' + response.status + '.';
  try { const payload = await response.json() as GeminiInteractionResponse; if (typeof payload.error?.message === 'string') message = payload.error.message.slice(0, 500); } catch { /* status-only */ }
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after'));
    return { code: 'rate_limited', message: 'Gemini rate limit reached. Try again later.', retryable: true, provider: 'gemini',
      ...(Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfterSeconds: Math.min(retryAfter, 3600) } : {}) };
  }
  if (response.status >= 500) return { code: 'provider_unavailable', message: 'Gemini is temporarily unavailable.', retryable: true, provider: 'gemini' };
  return { code: 'provider_rejected', message, retryable: false, provider: 'gemini' };
}