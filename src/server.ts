import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import type { Request, Response } from 'express';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request as httpRequest } from 'node:http';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

const OLLAMA_BASE = process.env['OLLAMA_HOST'] ?? 'http://127.0.0.1:11434';
const OLLAMA_TIMEOUT_MS = 120_000;

/**
 * Body parser phải mount trước route /api để tránh catch tất cả.
 * Giới hạn 4 MB để tránh abuse.
 */
app.use(express.json({ limit: '4mb' }));

/**
 * Proxy /api/chat -> Ollama Cloud OR Ollama Local.
 * Body: { provider, apiKey?, model, prompt, system?, temperature?, topK?, stream? }
 *
 * - cloud: forward to https://ollama.com/api/generate with Authorization: Bearer <...
 * - local: forward to OLLAMA_HOST/api/generate (server-side)
 *
 * Server-to-server, no CORS issue.
 */
app.post('/api/chat', (req: Request, res: Response) => {
  const body = (req.body ?? {}) as {
    provider?: string;
    apiKey?: string;
    model?: string;
    prompt?: string;
    system?: string;
    temperature?: number;
    topK?: number;
    stream?: boolean;
  };

  const provider = body.provider ?? 'local';
  const model = body.model ?? 'qwen2.5-coder:7b';
  const prompt = body.prompt ?? '';
  const temperature = body.temperature ?? 0.3;
  const topK = body.topK ?? 5;
  const stream = body.stream ?? true;
  const fullPrompt = body.system ? body.system + '\n\n' + prompt : prompt;

  let upstreamUrl: URL;
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/x-ndjson',
  };

  if (provider === 'cloud') {
    if (!body.apiKey) {
      res.status(400).json({ error: 'missing_api_key', message: 'Cloud provider requires apiKey' });
      return;
    }
    upstreamUrl = new URL('https://ollama.com/api/generate');
    headers['Authorization'] = 'Bearer ' + body.apiKey;
  } else {
    upstreamUrl = new URL('/api/generate', process.env['OLLAMA_HOST'] ?? 'http://127.0.0.1:11434');
  }

  // AUDIT LOG: trace apiKey from server side
  const apiKeyReceived = body.apiKey ?? '';
  console.log('[api/chat] ===== AUTH AUDIT START =====');
  console.log('[api/chat] provider=', provider);
  console.log('[api/chat] model=', model);
  console.log('[api/chat] stream=', stream);
  console.log('[api/chat] promptLen=', prompt.length);
  console.log('[api/chat] apiKey received?', apiKeyReceived.length > 0);
  console.log('[api/chat] apiKey length:', apiKeyReceived.length);
  console.log('[api/chat] apiKey first6+last4:', apiKeyReceived.length > 0 ? apiKeyReceived.slice(0, 6) + '***' + apiKeyReceived.slice(-4) : '(empty)');

  const upstreamBody = JSON.stringify({
    model,
    prompt: fullPrompt,
    stream,
    options: { temperature, top_k: topK },
  });

  const useHttps = upstreamUrl.protocol === 'https:';
  const lib = useHttps ? require('node:https') : require('node:http');

  // AUDIT: log upstream request details BEFORE sending
  console.log('[api/chat] --> upstream URL:', upstreamUrl.toString());
  console.log('[api/chat] --> upstream method: POST');
  console.log('[api/chat] --> upstream headers:', JSON.stringify(headers, null, 2));
  if (headers['Authorization']) {
    const authVal = headers['Authorization'];
    const masked = 'Bearer ' + authVal.slice(7, 13) + '***' + authVal.slice(-8);
    console.log('[api/chat] --> upstream Authorization (masked):', masked);
  } else {
    console.log('[api/chat] --> upstream Authorization: *** (none)');
  }

  const upstreamReq = lib.request({
    hostname: upstreamUrl.hostname,
    port: upstreamUrl.port || (useHttps ? '443' : '80'),
    path: upstreamUrl.pathname + upstreamUrl.search,
    method: 'POST',
    headers: { ...headers, 'Content-Length': Buffer.byteLength(upstreamBody).toString() },
    timeout: 120000,
  },
  (upRes: any) => {
    const status = upRes.statusCode ?? 502;
    if (status >= 400) {
      let errBody = '';
      upRes.on('data', (c: Buffer) => (errBody += c.toString()));
      upRes.on('end', () => {
        console.error('[api/chat] upstream ' + status + ': ' + errBody.slice(0, 200));
        if (!res.headersSent) {
          res.status(status).json({
            error: 'upstream_error',
            provider,
            status,
            detail: errBody.slice(0, 500),
          });
        }
      });
      return;
    }

    res.status(200);
    res.setHeader('Content-Type', upRes.headers['content-type'] ?? 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-store');
    upRes.on('data', (chunk: Buffer) => {
      if (!res.writableEnded) res.write(chunk);
    });
    upRes.on('end', () => {
      if (!res.writableEnded) res.end();
    });
    upRes.on('error', (err: Error) => {
      console.error('[api/chat] upstream stream error:', err);
      if (!res.writableEnded) res.end();
    });
  });

  upstreamReq.on('error', (err: Error) => {
    console.error('[api/chat] connect error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({
        error: 'upstream_unreachable',
        provider,
        message: 'Cannot reach ' + upstreamUrl.toString(),
        detail: err.message,
      });
    }
  });

  upstreamReq.on('timeout', () => {
    console.error('[api/chat] upstream timeout');
    upstreamReq.destroy(new Error('Upstream timeout'));
  });

  upstreamReq.end(upstreamBody);
});

/**
 * Proxy /api/ai/chat -> http://localhost:11434/api/chat (Ollama).
 * Forward stream NDJSON về client.
 */
app.post('/api/ai/chat', (req: Request, res: Response) => {
  const upstreamUrl = new URL('/api/chat', OLLAMA_BASE);
  const upstream = httpRequest(
    {
      hostname: upstreamUrl.hostname,
      port: upstreamUrl.port || '80',
      path: upstreamUrl.pathname + upstreamUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/x-ndjson',
      },
      timeout: OLLAMA_TIMEOUT_MS,
    },
    (upRes) => {
      // Set status code
      if (upRes.statusCode && upRes.statusCode >= 400) {
        res.status(upRes.statusCode);
      } else {
        res.status(200);
      }
      res.setHeader('Content-Type', upRes.headers['content-type'] ?? 'application/x-ndjson');
      res.setHeader('Cache-Control', 'no-store');
      if (upRes.statusCode && upRes.statusCode >= 400) {
        res.setHeader('X-AI-Proxy-Error', 'upstream');
      }
      upRes.on('data', (chunk: Buffer) => {
        if (!res.writableEnded) res.write(chunk);
      });
      upRes.on('end', () => {
        if (!res.writableEnded) res.end();
      });
      upRes.on('error', (err) => {
        // eslint-disable-next-line no-console
        console.error('[ai-proxy] upstream error', err);
        if (!res.headersSent) {
          res.status(502).json({
            error: 'upstream_error',
            message: err.message ?? String(err),
          });
        } else if (!res.writableEnded) {
          try {
            res.end(`\n{"error":"upstream_error","message":"${String(err).replace(/"/g, "'")}"}`);
          } catch {
            // ignore
          }
        }
      });
    },
  );

  upstream.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[ai-proxy] connect error', err);
    if (!res.headersSent) {
      res.status(502).json({
        error: 'upstream_unreachable',
        message: `Không kết nối được Ollama tại ${OLLAMA_BASE}. Hãy chắc chắn Ollama đang chạy.`,
        detail: err.message ?? String(err),
      });
    }
  });

  upstream.on('timeout', () => {
    // eslint-disable-next-line no-console
    console.error('[ai-proxy] upstream timeout');
    upstream.destroy(new Error('Upstream timeout'));
  });

  // ONLY destroy upstream when client truly aborts, not when req stream ends naturally
  req.on('aborted', () => {
    // eslint-disable-next-line no-console
    console.error('[ai-proxy] client aborted');
    upstream.destroy();
  });

  upstream.end(JSON.stringify(req.body ?? {}));
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use('/**', (req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * The request handler used by the Angular CLI (dev-server and during build).
 */
export const reqHandler = createNodeRequestHandler(app);
