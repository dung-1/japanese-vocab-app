import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';
import { OllamaChatRequest, OllamaStreamEvent } from '../models/stream-event.model';
import { parseNdjson } from '../utils/abortable-stream.util';

export interface ChatStreamHandle {
  abort: () => void;
}

/**
 * Service giao tiếp với Ollama thông qua SSR proxy `/api/ai/chat`.
 * Trả về Subject/Observable kiểu token stream; AiService đăng ký.
 */
@Injectable({ providedIn: 'root' })
export class OllamaService {
  readonly endpoint = environment.ai.ollamaProxy;
  readonly model = environment.ai.model;
  readonly temperature = environment.ai.temperature;

  readonly lastError = signal<string | null>(null);
  readonly available = signal(true);

  private readonly platformId = inject(PLATFORM_ID);

  /**
   * Stream chat. Gọi hàm `onToken` mỗi khi nhận được token mới.
   * Trả về handle để abort.
   */
  async chat(
    request: Omit<OllamaChatRequest, 'stream' | 'model'> & { model?: string },
    onToken: (token: string) => void,
    onDone?: (final: OllamaStreamEvent) => void,
    onError?: (err: Error) => void,
  ): Promise<ChatStreamHandle> {
    if (!isPlatformBrowser(this.platformId)) {
      const err = new Error('AI chỉ khả dụng trên trình duyệt (SSR không hỗ trợ).');
      onError?.(err);
      this.lastError.set(err.message);
      return { abort: () => {} };
    }
    const controller = new AbortController();
    const body: OllamaChatRequest = {
      model: request.model ?? this.model,
      messages: request.messages,
      stream: true,
      options: {
        temperature: request.options?.temperature ?? this.temperature,
      },
    };

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const err = new Error(`HTTP ${response.status}: ${text || response.statusText}`);
        this.lastError.set(err.message);
        this.available.set(false);
        onError?.(err);
        return { abort: () => controller.abort() };
      }
      if (!response.body) {
        const err = new Error('Response không có body stream');
        this.lastError.set(err.message);
        onError?.(err);
        return { abort: () => controller.abort() };
      }

      this.available.set(true);
      this.lastError.set(null);

      // Fire-and-forget stream processing (caller nhận token qua callback)
      (async () => {
        try {
          for await (const evt of parseNdjson(response.body as ReadableStream<Uint8Array>, controller.signal)) {
            const ev = evt as OllamaStreamEvent;
            if (ev.error) {
              this.lastError.set(ev.error);
              onError?.(new Error(ev.error));
              return;
            }
            // /api/chat returns message.content; /api/generate returns response.
            const token =
              ev.message?.content ??
              ev.response ??
              '';
            if (token.length > 0) {
              onToken(token);
            }
            if (ev.done) {
              onDone?.(ev);
              return;
            }
          }
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
          this.lastError.set((e as Error).message);
          onError?.(e as Error);
        }
      })();

      return { abort: () => controller.abort() };
    } catch (e) {
      const err = e as Error;
      this.lastError.set(err.message);
      this.available.set(false);
      onError?.(err);
      return { abort: () => controller.abort() };
    }
  }
}