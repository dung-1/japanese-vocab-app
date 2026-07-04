import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  AiProvider,
  ChatRequest,
  ChatStreamHandle,
  ChatTokenHandler,
  ChatDoneHandler,
  ChatErrorHandler,
} from './ai-provider.interface';
import { parseNdjson } from '../utils/abortable-stream.util';

/**
 * Ollama Cloud provider - goi qua server-side proxy /api/chat.
 * Browser khong the goi truc tiep https://ollama.com/api/generate (no CORS).
 * Server (src/server.ts) forward request toi Ollama Cloud voi Bearer Token.
 */
@Injectable({ providedIn: 'root' })
export class CloudProvider implements AiProvider {
  readonly id = 'cloud';
  readonly name = 'Ollama Cloud (via proxy)';

  private readonly platformId = inject(PLATFORM_ID);

  private apiKey = '';
  private model = 'nemotron-3-super:cloud';
  private proxyUrl = '/api/chat';

  configure(opts: { apiKey?: string; model?: string; proxyUrl?: string }): void {
    if (opts.apiKey) this.apiKey = opts.apiKey;
    if (opts.model) this.model = opts.model;
    if (opts.proxyUrl) this.proxyUrl = opts.proxyUrl;
  }

  async chat(
    request: ChatRequest,
    onToken: ChatTokenHandler,
    onDone?: ChatDoneHandler,
    onError?: ChatErrorHandler,
  ): Promise<ChatStreamHandle> {
    if (!isPlatformBrowser(this.platformId)) {
      onError?.(new Error('Cloud provider chi kha dung tren trinh duyet.'));
      return { abort: () => {} };
    }
    if (!this.apiKey) {
      onError?.(
        new Error('Chua nhap Cloud API Key. Vao AI Settings de cau hinh.'),
      );
      return { abort: () => {} };
    }

    const fullPrompt = request.system ? request.system + '\\n\\n' + request.user : request.user;
    const body = {
      provider: 'cloud',
      apiKey: this.apiKey,
      model: request.model || this.model,
      prompt: fullPrompt,
      stream: request.stream,
    };

    const controller = new AbortController();
    try {
      const res = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let msg = 'HTTP ' + res.status;
        try {
          const parsed = JSON.parse(text);
          msg = parsed.error ? parsed.error + ': ' + (parsed.message ?? parsed.detail ?? '') : msg;
        } catch {
          msg = msg + ': ' + (text || res.statusText);
        }
        onError?.(new Error(msg));
        return { abort: () => controller.abort() };
      }
      if (!res.body) {
        onError?.(new Error('Response khong co body stream'));
        return { abort: () => controller.abort() };
      }

      (async () => {
        try {
          for await (const evt of parseNdjson(
            res.body as ReadableStream<Uint8Array>,
            controller.signal,
          )) {
            const ev = evt as { response?: string; done?: boolean; error?: string };
            if (ev.error) {
              onError?.(new Error(ev.error));
              return;
            }
            if (typeof ev.response === 'string' && ev.response.length > 0) {
              onToken(ev.response);
            }
            if (ev.done) {
              onDone?.();
              return;
            }
          }
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
          onError?.(e as Error);
        }
      })();

      return { abort: () => controller.abort() };
    } catch (e) {
      const err = e as Error;
      onError?.(err);
      return { abort: () => controller.abort() };
    }
  }

  async testConnection(): Promise<{ ok: boolean; message: string; preview?: string }> {
    if (!this.apiKey) {
      return { ok: false, message: 'Chua nhap API Key.' };
    }
    try {
      const res = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'cloud',
          apiKey: this.apiKey,
          model: this.model,
          prompt: 'Hello',
          stream: false,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = 'HTTP ' + res.status;
        try {
          const parsed = JSON.parse(text);
          msg = parsed.detail ?? parsed.error ?? msg;
          return { ok: false, message: String(msg).slice(0, 300) };
        } catch {
          return { ok: false, message: (msg + ': ' + text).slice(0, 300) };
        }
      }
      const data = await res.json();
      const preview = (data.response ?? '').slice(0, 200);
      return {
        ok: true,
        message: 'Connected to Ollama Cloud (model: ' + this.model + ')',
        preview,
      };
    } catch (e) {
      const err = e as Error;
      return { ok: false, message: err.message };
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('Chua nhap Cloud API Key.');
    }

    const body = {
      provider: 'cloud',
      apiKey: this.apiKey,
      model: 'nomic-embed-text',
      prompt: text,
    };

    const res = await fetch('/api/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const textErr = await res.text().catch(() => '');
      throw new Error(`Cloud Embedding HTTP ${res.status}: ${textErr || res.statusText}`);
    }

    const data = await res.json();
    if (!data.embedding) {
      throw new Error('Cloud Embedding response không có trường embedding');
    }

    return data.embedding;
  }
}
