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
      if (err.name === 'TypeError' || err.message.includes('Failed to fetch')) {
        return this.chatViaProxy(request, controller, onToken, onDone, onError);
      }
      onError?.(err);
      return { abort: () => controller.abort() };
    }
  }

  private async chatViaProxy(
    request: ChatRequest,
    controller: AbortController,
    onToken: ChatTokenHandler,
    onDone?: ChatDoneHandler,
    onError?: ChatErrorHandler,
  ): Promise<ChatStreamHandle> {
    const proxyBody = {
      provider: 'local',
      model: request.model,
      prompt: this.combinePrompt(request),
      stream: request.stream,
      temperature: request.temperature ?? 0.3,
      topK: request.topK ?? 5,
    };
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proxyBody),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        onError?.(new Error(`Proxy HTTP ${res.status}: ${text.slice(0, 200)}`));
        return { abort: () => controller.abort() };
      }
      if (!res.body) {
        onError?.(new Error('Proxy response không có body'));
        return { abort: () => controller.abort() };
      }
      (async () => {
        try {
          for await (const evt of parseNdjson(res.body as ReadableStream<Uint8Array>, controller.signal)) {
            const ev = evt as { response?: string; done?: boolean; error?: string };
            if (ev.error) { onError?.(new Error(ev.error)); return; }
            if (typeof ev.response === 'string' && ev.response.length > 0) onToken(ev.response);
            if (ev.done) { onDone?.(); return; }
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
    const baseUrl = this.endpoint.replace(/\/+$/, '');
    const url = `${baseUrl}/api/generate`;
    const tagsUrl = `${baseUrl}/api/tags`;
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
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          prompt: 'Hello',
          stream: false,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
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
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        return this.testConnectionViaProxy(modelName);
      }
      return { ok: false, message: err.message };
    }
  }

  private async testConnectionViaProxy(
    model: string,
  ): Promise<{ ok: boolean; message: string; preview?: string }> {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'local',
          model,
          prompt: 'Hello',
          stream: false,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, message: `Proxy HTTP ${res.status}: ${text.slice(0, 200)}` };
      }
      const data = await res.json();
      const preview = (data.response ?? '').slice(0, 200);
      return {
        ok: true,
        message: `Connected to Ollama Local (via proxy, model: ${model})`,
        preview,
      };
    } catch (e) {
      const err = e as Error;
      return { ok: false, message: `Cả direct và proxy đều lỗi. Chi tiết: ${err.message}` };
    }
  }

  async embed(text: string): Promise<number[]> {
    const url = `${this.endpoint.replace(/\/+$/, '')}/api/embeddings`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'nomic-embed-text',
          prompt: text,
        }),
      });
      if (!res.ok) {
        const textErr = await res.text().catch(() => '');
        throw new Error(`Local Embedding HTTP ${res.status}: ${textErr || res.statusText}`);
      }
      const data = await res.json();
      if (!data.embedding) {
        throw new Error('Local Embedding response không có trường embedding');
      }
      return data.embedding;
    } catch (e) {
      const err = e as Error;
      throw err;
    }
  }

  private combinePrompt(req: ChatRequest): string {
    if (req.system) {
      return `${req.system}\n\n${req.user}`;
    }
    return req.user;
  }
}
