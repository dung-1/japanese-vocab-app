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
 * Local Ollama provider - gọi trực tiếp Ollama local server.
 * Endpoint mặc định: http://localhost:11434
 * API: POST /api/generate (payload { model, prompt, stream })
 *      hoặc /api/chat (payload { model, messages, stream })
 *
 * Lưu ý: Trên Vercel / browser ở máy khác, localhost KHÔNG truy cập được.
 *        Provider này dành cho dev local.
 */
@Injectable({ providedIn: 'root' })
export class LocalProvider implements AiProvider {
  readonly id = 'local';
  readonly name = 'Ollama Local';

  private readonly platformId = inject(PLATFORM_ID);

  private endpoint: string = 'http://localhost:11434';

  setEndpoint(endpoint: string): void {
    this.endpoint = endpoint;
  }

  async chat(
    request: ChatRequest,
    onToken: ChatTokenHandler,
    onDone?: ChatDoneHandler,
    onError?: ChatErrorHandler,
  ): Promise<ChatStreamHandle> {
    if (!isPlatformBrowser(this.platformId)) {
      const err = new Error('Local Ollama chỉ khả dụng trên trình duyệt.');
      onError?.(err);
      return { abort: () => {} };
    }

    const url = `${this.endpoint.replace(/\/+$/, '')}/api/generate`;
    const body = {
      model: request.model,
      prompt: this.combinePrompt(request),
      stream: request.stream,
      options: {
        temperature: request.temperature ?? 0.3,
        top_k: request.topK ?? 40,
      },
    };

    const controller = new AbortController();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(`HTTP ${res.status}: ${text || res.statusText}`);
        onError?.(err);
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
      const err = e as Error;
      onError?.(err);
      return { abort: () => controller.abort() };
    }
  }

  async testConnection(): Promise<{ ok: boolean; message: string; preview?: string }> {
    const baseUrl = this.endpoint.replace(/\/+$/, '');
    const url = `${baseUrl}/api/generate`;
    const tagsUrl = `${baseUrl}/api/tags`;
    // Detect first available model from /api/tags
    let modelName = 'qwen3:0.6b';
    try {
      const tagsRes = await fetch(tagsUrl, { method: 'GET' });
      if (tagsRes.ok) {
        const tagsData = await tagsRes.json();
        if (tagsData.models && tagsData.models.length > 0) {
          modelName = tagsData.models[0].name;
        }
      }
    } catch {}
    console.log('[LocalProvider] ===== testConnection START =====');
    console.log('[LocalProvider] this.endpoint=', this.endpoint);
    console.log('[LocalProvider] baseUrl=', baseUrl);
    console.log('[LocalProvider] url=', url);
    console.log('[LocalProvider] tagsUrl=', tagsUrl);
    console.log('[LocalProvider] window.location.origin=', typeof window !== 'undefined' ? window.location.origin : 'SSR');
    console.log('[LocalProvider] navigator.userAgent=', typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR');
    console.log('[LocalProvider] --> POST', url);
    console.log('[LocalProvider]     Headers: Content-Type=application/json');
    console.log('[LocalProvider]     Body: {model:', modelName, ', prompt:"Hello", stream:false}');
    try {
      // Already verified /api/tags above; tagsOk always true here
      // Step 2: send prompt 'Hello' to verify AI inference works
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          prompt: 'Hello',
          stream: false,
        }),
      });
      console.log('[LocalProvider.testConnection] /api/generate status=', res.status);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        // 404 = model not pulled yet
        if (res.status === 404) {
          return {
            ok: false,
            message: `Model '${modelName}' chua pull. Chay: ollama pull ${modelName}`,
          };
        }
        return { ok: false, message: `HTTP ${res.status}: ${text.slice(0, 200)}` };
      }
      const data = await res.json();
      const preview = (data.response ?? '').slice(0, 200);
      return {
        ok: true,
        message: `Connected to ${this.endpoint}`,
        preview,
      };
    } catch (e) {
      const err = e as Error;
      console.error('[LocalProvider.testConnection] error:', err);
      // Failed to fetch = network / CORS / Ollama down
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        return {
          ok: false,
          message: `Failed to fetch ${url}. Kiem tra: (1) Ollama chay? (2) CORS? (3) firewall?`,
        };
      }
      return { ok: false, message: err.message };
    }
  }

  private combinePrompt(req: ChatRequest): string {
    if (req.system) {
      return `${req.system}\n\n${req.user}`;
    }
    return req.user;
  }
}