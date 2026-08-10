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

app.use(express.json({ limit: '4mb' }));

app.options('/api/embed', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(204).end();
});

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

  const upstreamBody = JSON.stringify({
    model,
    prompt: fullPrompt,
    stream,
    options: { temperature, top_k: topK },
  });

  const useHttps = upstreamUrl.protocol === 'https:';
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
          if (!res.headersSent) {
            res.status(status).json({ error: 'upstream_error', provider, status, detail: errBody.slice(0, 500) });
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
        if (!res.writableEnded) res.end();
      });
    },
  );

  upstreamReq.on('error', (err: Error) => {
    if (!res.headersSent) {
      res.status(502).json({ error: 'upstream_unreachable', provider, message: `Cannot reach ${upstreamUrl.toString()}`, detail: err.message });
    }
  });

  upstreamReq.on('timeout', () => {
    upstreamReq.destroy(new Error('Upstream timeout'));
  });

  upstreamReq.end(upstreamBody);
});

app.post('/api/embed', (req: Request, res: Response) => {
  const body = (req.body ?? {}) as {
    provider?: string;
    apiKey?: string;
    text?: string;
    input?: string | string[];
    model?: string;
  };

  const provider = body.provider ?? 'local';
  const text = body.text ?? '';
  const input = body.input ?? (text ? [text] : []);
  const model = body.model ?? 'nomic-embed-text';

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!text && (!input || (Array.isArray(input) && input.length === 0))) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(400).json({ error: 'missing_text', message: 'text or input field is required' });
    return;
  }
  if (provider === 'cloud' && !body.apiKey) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(400).json({ error: 'missing_api_key', message: 'Cloud provider requires apiKey' });
    return;
  }

  let upstreamUrl: URL;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (provider === 'cloud') {
    upstreamUrl = new URL('https://ollama.com/api/embed');
    headers['Authorization'] = 'Bearer ' + body.apiKey;
  } else {
    upstreamUrl = new URL('/api/embed', process.env['OLLAMA_HOST'] ?? 'http://127.0.0.1:11434');
  }

  const upstreamBody = JSON.stringify({ model, input });
  const useHttps = upstreamUrl.protocol === 'https:';
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
          if (!res.headersSent) {
            res.status(status).json({ error: 'upstream_error', status, detail: data.slice(0, 300) });
          }
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.embeddings) {
            res.status(200).json({ embeddings: parsed.embeddings });
          } else if (parsed.embedding) {
            res.status(200).json({ embedding: parsed.embedding });
          } else {
            res.status(502).json({ error: 'parse_error', detail: 'Unexpected response format' });
          }
        } catch {
          res.status(502).json({ error: 'parse_error', raw: data.slice(0, 200) });
        }
      });
    },
  );

  upstreamReq.on('error', (err: Error) => {
    if (!res.headersSent) {
      res.status(502).json({ error: 'upstream_unreachable', provider, message: `Cannot reach ${upstreamUrl.toString()}`, detail: err.message });
    }
  });

  upstreamReq.on('timeout', () => {
    upstreamReq.destroy(new Error('Embedding upstream timeout'));
  });

  upstreamReq.end(upstreamBody);
});

app.use(express.static(browserDistFolder, { maxAge: '1y', index: false, redirect: false }));

app.use('/**', (req, res, next) => {
  angularApp.handle(req).then((response) => response ? writeResponseToNodeResponse(response, res) : next()).catch(next);
});

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
