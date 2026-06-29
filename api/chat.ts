/**
 * api/chat.ts — Vercel Serverless Function
 *
 * Xử lý POST /api/chat — proxy tới Ollama Local hoặc Ollama Cloud.
 * Đây là file duy nhất chứa logic API khi deploy lên Vercel.
 *
 * Lý do cần file này:
 *   - Vercel KHÔNG chạy Express server (server.ts) ở runtime
 *   - Vercel chỉ serve static files + serverless functions trong api/
 *   - Route /api/chat trong Express không tồn tại trên Vercel → 404
 *   - File này là Vercel Function tương đương với route Express đó
 *
 * Body: {
 *   provider: 'local' | 'cloud'
 *   apiKey?: string         (bắt buộc với provider=cloud)
 *   model: string
 *   prompt: string
 *   system?: string
 *   temperature?: number
 *   topK?: number
 *   stream?: boolean
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import type { RequestOptions } from 'node:http';

export const config = {
  maxDuration: 60, // Vercel Pro: 60s max. Hobby plan bị giới hạn 10s.
};

type ChatBody = {
  provider?: string;
  apiKey?: string;
  model?: string;
  prompt?: string;
  system?: string;
  temperature?: number;
  topK?: number;
  stream?: boolean;
};

export default function handler(req: VercelRequest, res: VercelResponse): void {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed', message: 'Only POST is supported' });
    return;
  }

  const body = (req.body ?? {}) as ChatBody;
  const provider = body.provider ?? 'local';
  const model = body.model ?? 'qwen3:0.6b';
  const prompt = body.prompt ?? '';
  const temperature = body.temperature ?? 0.3;
  const topK = body.topK ?? 5;
  const stream = body.stream ?? true;
  const fullPrompt = body.system ? body.system + '\n\n' + prompt : prompt;

  // Cloud: bắt buộc có apiKey
  if (provider === 'cloud' && !body.apiKey) {
    res.status(400).json({
      error: 'missing_api_key',
      message: 'Cloud provider requires apiKey in request body',
    });
    return;
  }

  const upstreamBody = JSON.stringify({
    model,
    prompt: fullPrompt,
    stream,
    options: { temperature, top_k: topK },
  });

  if (provider === 'cloud') {
    const apiKeyMasked =
      (body.apiKey ?? '').length > 10
        ? (body.apiKey ?? '').slice(0, 6) + '***' + (body.apiKey ?? '').slice(-4)
        : '(short)';
    console.log(`[api/chat] cloud model=${model} stream=${stream} apiKey=${apiKeyMasked}`);

    forwardToOllama(
      {
        url: new URL('https://ollama.com/api/generate'),
        isHttps: true,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/x-ndjson',
          Authorization: 'Bearer ' + body.apiKey,
        },
        body: upstreamBody,
        provider,
      },
      res,
    );
  } else {
    // Local provider — cần OLLAMA_HOST env var khi deploy Vercel
    // Mặc định: 127.0.0.1:11434 KHÔNG có trên Vercel (không có Ollama)
    // User phải set OLLAMA_HOST env var trong Vercel dashboard
    const ollamaHost = process.env['OLLAMA_HOST'] ?? 'http://127.0.0.1:11434';
    const localUrl = new URL('/api/generate', ollamaHost);
    console.log(`[api/chat] local model=${model} upstream=${localUrl.toString()}`);

    if (ollamaHost === 'http://127.0.0.1:11434') {
      console.warn('[api/chat] WARNING: OLLAMA_HOST not set. Local Ollama không chạy trên Vercel!');
    }

    forwardToOllama(
      {
        url: localUrl,
        isHttps: localUrl.protocol === 'https:',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/x-ndjson',
        },
        body: upstreamBody,
        provider,
      },
      res,
    );
  }
}

type ForwardOptions = {
  url: URL;
  isHttps: boolean;
  headers: Record<string, string>;
  body: string;
  provider: string;
};

function forwardToOllama(opts: ForwardOptions, res: VercelResponse): void {
  const { url, isHttps, headers, body, provider } = opts;
  const reqFn = isHttps ? httpsRequest : httpRequest;

  const options: RequestOptions = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    method: 'POST',
    headers: { ...headers, 'Content-Length': Buffer.byteLength(body).toString() },
    timeout: 55_000,
  };

  const upstreamReq = reqFn(options, (upRes) => {
    const status = upRes.statusCode ?? 502;

    if (status >= 400) {
      let errBody = '';
      upRes.on('data', (c: Buffer) => (errBody += c.toString()));
      upRes.on('end', () => {
        console.error(`[api/chat] upstream ${status}: ${errBody.slice(0, 300)}`);
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
    res.setHeader('Access-Control-Allow-Origin', '*');

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
  });

  upstreamReq.on('error', (err: Error) => {
    console.error('[api/chat] connect error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({
        error: 'upstream_unreachable',
        provider,
        message: `Cannot reach ${url.toString()}`,
        detail: err.message,
      });
    }
  });

  upstreamReq.on('timeout', () => {
    upstreamReq.destroy(new Error('Upstream timeout after 55s'));
  });

  upstreamReq.end(body);
}
