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

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Body parser phải mount trước route /api để tránh catch tất cả.
 * Giới hạn 4 MB để tránh abuse.
 */
app.use(express.json({ limit: '4mb' }));

/**
 * Proxy /api/chat -> Ollama Cloud OR Ollama Local.
 * Body: { provider, apiKey?, model, prompt, system?, temperature?, topK?, stream? }
 *
 * - local: forward to OLLAMA_HOST/api/generate (server-to-server, no CORS)
 * - cloud: forward to https://ollama.com/api/generate with Authorization: Bearer <apiKey>
 *
 * Browser gọi /api/chat (same-origin) → không bao giờ có CORS issue.
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
  const model = body.model ?? 'qwen3:0.6b';
  const prompt = body.prompt ?? '';
  const temperature = body.temperature ?? 0.3;
  const topK = body.topK ?? 5;
  const stream = body.stream ?? true;
  const fullPrompt = body.system ? body.system + '\n\n' + prompt : prompt;

  let upstreamUrl: URL;
  const headers: Record<string, string> = {
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

  const apiKeyReceived = body.apiKey ?? '';
  console.log(`[api/chat] provider=${provider} model=${model} stream=${stream} promptLen=${prompt.length}`);
  if (provider === 'cloud') {
    const masked = apiKeyReceived.length > 10
      ? apiKeyReceived.slice(0, 6) + '***' + apiKeyReceived.slice(-4)
      : '(short/empty)';
    console.log(`[api/chat] --> cloud upstream | apiKey: ${masked}`);
  } else {
    console.log(`[api/chat] --> local upstream: ${upstreamUrl.toString()}`);
  }

  const upstreamBody = JSON.stringify({
    model,
    prompt: fullPrompt,
    stream,
    options: { temperature, top_k: topK },
  });

  const useHttps = upstreamUrl.protocol === 'https:';
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lib = useHttps ? require('node:https') : require('node:http');

  const upstreamReq = lib.request(
    {
      hostname: upstreamUrl.hostname,
      port: upstreamUrl.port || (useHttps ? '443' : '80'),
      path: upstreamUrl.pathname + upstreamUrl.search,
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(upstreamBody).toString() },
      timeout: 120_000,
    },
    (upRes: any) => {
      const status = upRes.statusCode ?? 502;
      if (status >= 400) {
        let errBody = '';
        upRes.on('data', (c: Buffer) => (errBody += c.toString()));
        upRes.on('end', () => {
          console.error(`[api/chat] upstream ${status}: ${errBody.slice(0, 200)}`);
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
        console.error('[api/chat] upstream stream error:', err.message);
        if (!res.writableEnded) res.end();
      });
    },
  );

  upstreamReq.on('error', (err: Error) => {
    console.error('[api/chat] connect error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({
        error: 'upstream_unreachable',
        provider,
        message: `Cannot reach ${upstreamUrl.toString()}`,
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
 * Proxy /api/embeddings -> Ollama Local OR Ollama Cloud.
 * Body: { provider, apiKey?, text, model? }
 * Response: { embedding: number[] }
 */
app.post('/api/embeddings', (req: Request, res: Response) => {
  const body = (req.body ?? {}) as {
    provider?: string;
    apiKey?: string;
    text?: string;
    model?: string;
  };

  const provider = body.provider ?? 'local';
  const text = body.text ?? '';
  const model = body.model ?? 'nomic-embed-text';

  if (!text) {
    res.status(400).json({ error: 'missing_text', message: 'text field is required' });
    return;
  }
  if (provider === 'cloud' && !body.apiKey) {
    res.status(400).json({ error: 'missing_api_key', message: 'Cloud provider requires apiKey' });
    return;
  }

  let upstreamUrl: URL;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (provider === 'cloud') {
    upstreamUrl = new URL('https://ollama.com/api/embeddings');
    headers['Authorization'] = 'Bearer ' + body.apiKey;
  } else {
    upstreamUrl = new URL('/api/embeddings', process.env['OLLAMA_HOST'] ?? 'http://127.0.0.1:11434');
  }

  console.log(`[api/embeddings] provider=${provider} model=${model} textLen=${text.length}`);

  const upstreamBody = JSON.stringify({ model, prompt: text });
  const useHttps = upstreamUrl.protocol === 'https:';
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lib = useHttps ? require('node:https') : require('node:http');

  const upstreamReq = lib.request(
    {
      hostname: upstreamUrl.hostname,
      port: upstreamUrl.port || (useHttps ? '443' : '80'),
      path: upstreamUrl.pathname,
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(upstreamBody).toString() },
      timeout: 60_000,
    },
    (upRes: any) => {
      const status = upRes.statusCode ?? 502;
      let data = '';
      upRes.on('data', (c: Buffer) => (data += c.toString()));
      upRes.on('end', () => {
        if (status >= 400) {
          console.error(`[api/embeddings] upstream ${status}: ${data.slice(0, 200)}`);
          if (!res.headersSent) {
            res.status(status).json({ error: 'upstream_error', status, detail: data.slice(0, 300) });
          }
          return;
        }
        try {
          const parsed = JSON.parse(data);
          res.status(200).json({ embedding: parsed.embedding ?? [] });
        } catch {
          res.status(502).json({ error: 'parse_error', raw: data.slice(0, 200) });
        }
      });
    },
  );

  upstreamReq.on('error', (err: Error) => {
    console.error('[api/embeddings] connect error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({
        error: 'upstream_unreachable',
        provider,
        message: `Cannot reach ${upstreamUrl.toString()}`,
        detail: err.message,
      });
    }
  });

  upstreamReq.on('timeout', () => {
    upstreamReq.destroy(new Error('Embedding upstream timeout'));
  });

  upstreamReq.end(upstreamBody);
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
