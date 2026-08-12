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
import { AiSettingsService } from '../services/ai-settings.service';
import { environment } from '../../../environments/environment';

/**
 * Ollama Cloud provider - gọi qua server-side proxy /api/chat.
 */
@Injectable({ providedIn: 'root' })
export class CloudProvider implements AiProvider {
  readonly id = 'cloud';
  readonly name = 'Ollama Cloud (via proxy)';

  private readonly platformId = inject(PLATFORM_ID);
  private readonly settingsSvc = inject(AiSettingsService);

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
      onError?.(new Error('Cloud provider chỉ khả dụng trên trình duyệt.'));
      return { abort: () => {} };
    }

    if (!this.apiKey) {
      onError?.(new Error('Chưa nhập Cloud API Key.'));
      return { abort: () => {} };
    }

    const fullPrompt = request.system ? request.system + '\n\n' + request.user : request.user;
    const body = {
      provider: 'cloud',
      apiKey: this.apiKey,
      model: request.model || this.model,
      prompt: fullPrompt,
      stream: request.stream,
    };

    const controller = new AbortController();
    try {
      const baseUrl = this.settingsSvc.baseUrl();
      const res = await fetch(`${baseUrl}${this.proxyUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        onError?.(new Error(`HTTP ${res.status}: ${text}`));
        return { abort: () => controller.abort() };
      }

      if (!res.body) {
        onError?.(new Error('Response không có body stream'));
        return { abort: () => controller.abort() };
      }

      (async () => {
        try {
          for await (const evt of parseNdjson(res.body as ReadableStream<Uint8Array>, controller.signal)) {
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
      onError?.(e as Error);
      return { abort: () => controller.abort() };
    }
  }

  async testConnection(): Promise<{ ok: boolean; message: string; preview?: string }> {
    if (!this.apiKey) return { ok: false, message: 'Chưa nhập Cloud API Key.' };
    try {
      const baseUrl = this.settingsSvc.baseUrl();
      const res = await fetch(`${baseUrl}${this.proxyUrl}`, {
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
      if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
      const data = await res.json();
      return { ok: true, message: 'Connected', preview: (data.response ?? '').slice(0, 200) };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async embed(input: string | string[]): Promise<number[][]> {
    if (!this.apiKey) throw new Error('Chưa nhập Cloud API Key.');
    const baseUrl = this.settingsSvc.baseUrl();
    const res = await fetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'cloud',
        model: 'nomic-embed-text',
        input: input,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data.embeddings)) {
      return data.embeddings;
    } else if (data.embedding) {
      return [data.embedding];
    }
    return [];
  }
}
