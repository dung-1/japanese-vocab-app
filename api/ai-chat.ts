/**
 * POST /api/ai-chat — provider-neutral cloud AI gateway.
 *
 * This is intentionally a new endpoint: the legacy /api/chat (Ollama Local /
 * Ollama Cloud) and /api/embed routes remain untouched during migration.
 * Cloud credentials are read only from server environment variables.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'node:crypto';
import { validateAiChatRequest } from './_lib/ai/contracts.ts';
import { GeminiProviderAdapter } from './_lib/ai/gemini.adapter.ts';
import { GroqProviderAdapter } from './_lib/ai/groq.adapter.ts';
import { generateWithFallback, StaticAiProviderRegistry } from './_lib/ai/provider-registry.ts';

export const config = { maxDuration: 60 };

type ClientEvent =
  | { response: string }
  | { done: true }
  | { error: string; code: string; retryable: boolean; provider?: string };

export interface AiChatHandlerDependencies {
  createRegistry?: () => StaticAiProviderRegistry;
  env?: Record<string, string | undefined>;
}

export function createAiChatHandler(dependencies: AiChatHandlerDependencies = {}) {
  return async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const env = { ...process.env, ...(dependencies.env ?? {}) };
  const corsAllowed = setCors(req, res, env);

  if (req.method === 'OPTIONS') {
    res.status(corsAllowed ? 204 : 403).end();
    return;
  }
  if (!corsAllowed) {
    res.status(403).json({ error: 'origin_not_allowed', message: 'This origin is not allowed to call the AI gateway.' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed', message: 'Only POST is supported' });
    return;
  }

  const expectedToken = env['AI_DEVICE_TOKEN'];
  const authHeader = req.headers.authorization;
  const suppliedToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7) : '';
  if (!expectedToken || !suppliedToken || !safeTokenEqual(suppliedToken, expectedToken)) {
    res.status(expectedToken ? 401 : 503).json({
      error: { code: expectedToken ? 'unauthorized' : 'gateway_not_configured',
        message: expectedToken ? 'Device is not authorized for the AI gateway.' : 'AI gateway authentication is not configured.',
        retryable: false },
    });
    return;
  }

  const contentType = req.headers['content-type'];
  if (typeof contentType !== 'string' || !contentType.toLowerCase().includes('application/json')) {
    res.status(415).json({ error: 'unsupported_media_type', message: 'Content-Type must be application/json.' });
    return;
  }

  // Vercel parses JSON before invoking the handler; enforce a second application
  // limit to reject oversized payloads before provider selection/upstream calls.
  const serializedBody = JSON.stringify(req.body ?? null);
  const bodyBytes = Buffer.byteLength(serializedBody, 'utf8');
  const maxBodyBytes = Number(env['AI_MAX_BODY_BYTES'] ?? 10_000_000);
  if (!Number.isFinite(maxBodyBytes) || maxBodyBytes < 1 || bodyBytes > maxBodyBytes) {
    res.status(413).json({ error: 'payload_too_large', message: 'AI request payload exceeds the configured size limit.' });
    return;
  }

  const validated = validateAiChatRequest(req.body);
  if (!validated.ok) {
    res.status(400).json({ error: validated.error });
    return;
  }

  const request = validated.request;
  if (request.provider === 'local') {
    res.status(400).json({
      error: {
        code: 'unsupported_capability',
        message: 'Use the existing /api/chat route for Ollama Local during this migration.',
        retryable: false,
      },
    });
    return;
  }

  const registry = dependencies.createRegistry?.() ?? new StaticAiProviderRegistry([
    new GeminiProviderAdapter(),
    new GroqProviderAdapter(),
  ]);
  const fallbackEnabled = env['AI_CLOUD_FALLBACK_ENABLED'] === 'true';
  const fallbackOrder = fallbackEnabled
    ? { gemini: ['groq'] as Array<'gemini' | 'groq'>, groq: ['gemini'] as Array<'gemini' | 'groq'> }
    : {};

  const controller = new AbortController();
  const abortOnDisconnect = () => {
    if (req.aborted || res.destroyed) controller.abort();
  };
  req.on('aborted', abortOnDisconnect);
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  let fullText = '';
  let streamStarted = false;

  try {
    for await (const event of generateWithFallback(
      request,
      controller.signal,
      registry,
      { fallbackOrder },
    )) {
      if (controller.signal.aborted || res.destroyed) return;

      if (event.type === 'token') {
        fullText += event.token;
        if (request.stream !== false) {
          if (!streamStarted) {
            res.status(200);
            res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store, no-transform');
            res.setHeader('X-Accel-Buffering', 'no');
            streamStarted = true;
          }
          writeEvent(res, { response: event.token });
        }
      } else if (event.type === 'done') {
        if (request.stream === false) {
          res.status(200).json({ response: fullText });
        } else {
          if (!streamStarted) {
            res.status(200);
            res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store, no-transform');
          }
          writeEvent(res, { done: true });
          res.end();
        }
        return;
      } else {
        const safeError: ClientEvent = {
          error: event.error.message,
          code: event.error.code,
          retryable: event.error.retryable,
          ...(event.error.provider ? { provider: event.error.provider } : {}),
        };
        if (!streamStarted) {
          res.status(statusForError(event.error.code)).json({ error: safeError });
        } else {
          writeEvent(res, safeError);
          res.end();
        }
        return;
      }
    }
  } catch {
    if (!controller.signal.aborted && !res.destroyed) {
      const safeError: ClientEvent = {
        error: 'AI gateway encountered an unexpected error.',
        code: 'internal_error',
        retryable: false,
      };
      if (!streamStarted) res.status(500).json({ error: safeError });
      else {
        writeEvent(res, safeError);
        res.end();
      }
    }
  }
  };
}

export default createAiChatHandler();

function writeEvent(res: VercelResponse, event: ClientEvent): void {
  if (!res.writableEnded && !res.destroyed) res.write(JSON.stringify(event) + '\n');
}

function statusForError(code: string): number {
  switch (code) {
    case 'invalid_request': return 400;
    case 'provider_not_configured': return 503;
    case 'unsupported_capability': return 400;
    case 'rate_limited': return 429;
    case 'upstream_timeout': return 504;
    case 'provider_rejected': return 502;
    case 'provider_unavailable': return 503;
    default: return 500;
  }
}

function setCors(
  req: VercelRequest,
  res: VercelResponse,
  env: Record<string, string | undefined>,
): boolean {
  const origin = req.headers.origin;
  const configured = (env['AI_ALLOWED_ORIGINS'] ?? [
    'https://japanese-vocab-app-dungcts.vercel.app',
    'http://localhost:4200',
    'http://127.0.0.1:4200',
    'capacitor://localhost',
    'ionic://localhost',
  ].join(',')).split(',').map(value => value.trim()).filter(Boolean);
  // Requests without Origin include same-origin/non-browser clients. CORS is
  // a browser boundary only and is NOT authentication or abuse protection.
  const allowed = !origin || configured.includes(origin);
  res.setHeader('Vary', 'Origin');
  if (origin && allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  return allowed;
}

function safeTokenEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
