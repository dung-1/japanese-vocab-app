/**
 * POST /api/ai-chat — provider-neutral cloud AI gateway.
 *
 * This is intentionally a new endpoint: the legacy /api/chat (Ollama Local /
 * Ollama Cloud) and /api/embed routes remain untouched during migration.
 * Cloud credentials are read only from server environment variables.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateAiChatRequest } from './_lib/ai/contracts.ts';
import { GeminiProviderAdapter } from './_lib/ai/gemini.adapter.ts';
import { GroqProviderAdapter } from './_lib/ai/groq.adapter.ts';
import { generateWithFallback, StaticAiProviderRegistry } from './_lib/ai/provider-registry.ts';

export const config = { maxDuration: 60 };

type ClientEvent =
  | { response: string }
  | { done: true; provider: 'gemini' | 'groq' }
  | { error: string; code: string; retryable: boolean; provider?: string };

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed', message: 'Only POST is supported' });
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

  const registry = new StaticAiProviderRegistry([
    new GeminiProviderAdapter(),
    new GroqProviderAdapter(),
  ]);
  const fallbackEnabled = process.env['AI_CLOUD_FALLBACK_ENABLED'] === 'true';
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
  let selectedProvider: 'gemini' | 'groq' = request.provider;
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
          res.status(200).json({ response: fullText, provider: selectedProvider });
        } else {
          if (!streamStarted) {
            res.status(200);
            res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store, no-transform');
          }
          writeEvent(res, { done: true, provider: selectedProvider });
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
}

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

function setCors(res: VercelResponse): void {
  // Same-origin browser calls are expected. Wildcard retained for current
  // mobile clients; tighten to the deployed origin before public rollout.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
