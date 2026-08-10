/**
 * api/embed.ts — Vercel Serverless Function
 * 
 * Xử lý POST /api/embed — proxy tới Ollama /api/embed.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import type { RequestOptions } from 'node:http';

export const config = {
  maxDuration: 30,
};

type EmbedBody = {
  provider?: string;
  apiKey?: string;
  text?: string;
  model?: string;
};

export default function handler(req: VercelRequest, res: VercelResponse): void {
  const setCorsHeaders = (response: VercelResponse) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  };

  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.status(204).end();
    return;
  }

  setCorsHeaders(res);

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const body = (req.body ?? {}) as EmbedBody;
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

  // FIX BUG-004: Ollama /api/embeddings expects 'input' field, not 'prompt'
  const upstreamBody = JSON.stringify({ model, input: text });
  let upstreamUrl: URL;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(upstreamBody).toString(),
  };

  if (provider === 'cloud') {
    upstreamUrl = new URL('https://ollama.com/api/embed');
    headers['Authorization'] = 'Bearer ' + body.apiKey;
  } else {
    const ollamaHost = process.env['OLLAMA_HOST'] ?? 'http://127.0.0.1:11434';
    upstreamUrl = new URL('/api/embed', ollamaHost);
  }

  const isHttps = upstreamUrl.protocol === 'https:';
  const reqFn = isHttps ? httpsRequest : httpRequest;

  const options: RequestOptions = {
    hostname: upstreamUrl.hostname,
    port: upstreamUrl.port || (isHttps ? 443 : 80),
    path: upstreamUrl.pathname,
    method: 'POST',
    headers,
    timeout: 25_000,
  };

  const upstreamReq = reqFn(options, (upRes) => {
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
        const parsed = JSON.parse(data) as { embeddings?: number[][] };
        res.status(200).json({ embedding: parsed.embeddings?.[0] ?? [] });
      } catch {
        res.status(502).json({ error: 'parse_error', raw: data.slice(0, 200) });
      }
    });
  });

  upstreamReq.on('error', (err: Error) => {
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
    upstreamReq.destroy(new Error('Embedding timeout'));
  });

  upstreamReq.end(upstreamBody);
}
