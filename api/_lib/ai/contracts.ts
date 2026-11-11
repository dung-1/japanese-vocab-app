/**
 * Provider-neutral contract for the AI gateway.
 *
 * This module deliberately contains no provider SDK or secret handling.
 * Provider credentials must be read only by server-side adapters from env.
 */

export type AiProviderId = 'gemini' | 'groq' | 'local';

export interface AiImageInput {
  /** MIME type of the original image. */
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  /** Base64 payload without a data: URL prefix. */
  data: string;
}

export interface AiChatGatewayRequest {
  provider: AiProviderId;
  model: string;
  prompt: string;
  system?: string;
  temperature?: number;
  topK?: number;
  stream?: boolean;
  /** Reserved for the vision phase. Providers must reject unsupported images. */
  images?: AiImageInput[];
}

export type AiGatewayErrorCode =
  | 'invalid_request'
  | 'provider_not_configured'
  | 'unsupported_capability'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'provider_rejected'
  | 'upstream_timeout'
  | 'internal_error';

export interface AiGatewayError {
  code: AiGatewayErrorCode;
  message: string;
  retryable: boolean;
  provider?: AiProviderId;
  retryAfterSeconds?: number;
}

export type AiGatewayStreamEvent =
  | { type: 'token'; token: string }
  | { type: 'done' }
  | { type: 'error'; error: AiGatewayError };

export interface AiModelCapabilities {
  text: boolean;
  vision: boolean;
  streaming: boolean;
}

export interface AiProviderAdapter {
  readonly id: AiProviderId;
  getCapabilities(model: string): AiModelCapabilities;
  generate(
    request: AiChatGatewayRequest,
    signal: AbortSignal,
  ): AsyncIterable<AiGatewayStreamEvent>;
}

export interface AiGatewaySuccess {
  provider: AiProviderId;
  model: string;
  content: string;
}

export interface AiGatewayErrorResponse {
  error: AiGatewayError;
}

const MAX_PROMPT_LENGTH = 40_000;
const MAX_SYSTEM_LENGTH = 12_000;
const MAX_IMAGES = 4;
const MAX_IMAGE_BASE64_CHARS = 8_000_000;
const ALLOWED_IMAGE_TYPES = new Set<AiImageInput['mimeType']>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export function validateAiChatRequest(
  value: unknown,
): { ok: true; request: AiChatGatewayRequest } | { ok: false; error: AiGatewayError } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalid('Request body must be a JSON object.');
  }

  const body = value as Record<string, unknown>;
  const provider = body['provider'];
  const model = body['model'];
  const prompt = body['prompt'];
  const system = body['system'];
  const temperature = body['temperature'];
  const topK = body['topK'];
  const stream = body['stream'];
  const images = body['images'];

  if (provider !== 'gemini' && provider !== 'groq' && provider !== 'local') {
    return invalid('provider must be gemini, groq, or local.');
  }
  if (typeof model !== 'string' || !model.trim() || model.length > 160) {
    return invalid('model must be a non-empty string of at most 160 characters.');
  }
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > MAX_PROMPT_LENGTH) {
    return invalid(`prompt must contain 1–${MAX_PROMPT_LENGTH} characters.`);
  }
  if (system !== undefined && (typeof system !== 'string' || system.length > MAX_SYSTEM_LENGTH)) {
    return invalid(`system must be a string of at most ${MAX_SYSTEM_LENGTH} characters.`);
  }
  if (temperature !== undefined && (
    typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < 0 || temperature > 2
  )) {
    return invalid('temperature must be a number between 0 and 2.');
  }
  if (topK !== undefined && (
    typeof topK !== 'number' || !Number.isInteger(topK) || topK < 1 || topK > 100
  )) {
    return invalid('topK must be an integer between 1 and 100.');
  }
  if (stream !== undefined && typeof stream !== 'boolean') {
    return invalid('stream must be a boolean.');
  }
  if (images !== undefined) {
    if (!Array.isArray(images) || images.length > MAX_IMAGES) {
      return invalid(`images must be an array containing at most ${MAX_IMAGES} images.`);
    }
    for (const image of images) {
      if (!image || typeof image !== 'object' || Array.isArray(image)) {
        return invalid('Each image must be an object.');
      }
      const candidate = image as Record<string, unknown>;
      if (typeof candidate['mimeType'] !== 'string' ||
          !ALLOWED_IMAGE_TYPES.has(candidate['mimeType'] as AiImageInput['mimeType']) ||
          typeof candidate['data'] !== 'string' ||
          !candidate['data'].trim() ||
          candidate['data'].length > MAX_IMAGE_BASE64_CHARS) {
        return invalid('Image payload has an unsupported MIME type or invalid/oversized base64 data.');
      }
    }
  }

  return {
    ok: true,
    request: {
      provider,
      model: model.trim(),
      prompt,
      ...(typeof system === 'string' ? { system } : {}),
      ...(typeof temperature === 'number' ? { temperature } : {}),
      ...(typeof topK === 'number' ? { topK } : {}),
      ...(typeof stream === 'boolean' ? { stream } : {}),
      ...(Array.isArray(images) ? { images: images as AiImageInput[] } : {}),
    },
  };
}

function invalid(message: string): { ok: false; error: AiGatewayError } {
  return {
    ok: false,
    error: {
      code: 'invalid_request',
      message,
      retryable: false,
    },
  };
}
