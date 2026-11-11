import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  AiProvider, ChatRequest, ChatStreamHandle, ChatTokenHandler,
  ChatDoneHandler, ChatErrorHandler,
} from './ai-provider.interface';
import { parseNdjson } from '../utils/abortable-stream.util';
import { AiSettingsService } from '../services/ai-settings.service';

/** Gemini/Groq cloud gateway. Provider secrets are configured only on Vercel. */
@Injectable({ providedIn: 'root' })
export class CloudProvider implements AiProvider {
  readonly id = 'cloud';
  readonly name = 'Gemini / Groq (server gateway)';
  private readonly platformId = inject(PLATFORM_ID);
  private readonly settings = inject(AiSettingsService);
  private readonly proxyUrl = '/api/ai-chat';

  async chat(
    request: ChatRequest,
    onToken: ChatTokenHandler,
    onDone?: ChatDoneHandler,
    onError?: ChatErrorHandler,
  ): Promise<ChatStreamHandle> {
    if (!isPlatformBrowser(this.platformId)) {
      onError?.(new Error('Cloud AI chỉ khả dụng trên trình duyệt.'));
      return { abort: () => {} };
    }

    const controller = new AbortController();
    try {
      const provider = this.settings.get().cloudProvider ?? 'gemini';
      const res = await fetch(`${this.settings.baseUrl()}${this.proxyUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.settings.get().cloudDeviceToken ?? ''}` },
        body: JSON.stringify({
          provider,
          model: request.model,
          system: request.system,
          prompt: request.user,
          temperature: request.temperature ?? 0.3,
          topK: request.topK ?? 5,
          stream: request.stream,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null) as {
          error?: { message?: string; error?: string; code?: string };
        } | null;
        const message = data?.error?.message ?? data?.error?.error ?? `HTTP ${res.status}`;
        onError?.(new Error(message));
        return { abort: () => controller.abort() };
      }

      if (!request.stream) {
        const data = await res.json() as { response?: string };
        if (data.response) onToken(data.response);
        onDone?.();
        return { abort: () => controller.abort() };
      }

      if (!res.body) {
        onError?.(new Error('Gateway response không có body stream.'));
        return { abort: () => controller.abort() };
      }

      void (async () => {
        try {
          for await (const raw of parseNdjson(res.body as ReadableStream<Uint8Array>, controller.signal)) {
            const event = raw as { response?: string; done?: boolean; error?: string; code?: string };
            if (event.error) {
              onError?.(new Error(event.error));
              return;
            }
            if (typeof event.response === 'string' && event.response.length) onToken(event.response);
            if (event.done) {
              onDone?.();
              return;
            }
          }
          if (!controller.signal.aborted) onDone?.();
        } catch (error) {
          if ((error as Error).name !== 'AbortError') onError?.(error as Error);
        }
      })();
      return { abort: () => controller.abort() };
    } catch (error) {
      if ((error as Error).name !== 'AbortError') onError?.(error as Error);
      return { abort: () => controller.abort() };
    }
  }

  async testConnection(): Promise<{ ok: boolean; message: string; preview?: string }> {
    const provider = this.settings.get().cloudProvider ?? 'gemini';
    const controller = new AbortController();
    try {
      const res = await fetch(`${this.settings.baseUrl()}${this.proxyUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.settings.get().cloudDeviceToken ?? ''}` },
        body: JSON.stringify({
          provider, model: this.settings.get().model,
          prompt: 'Reply with a short greeting.', stream: false,
        }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({})) as { response?: string; error?: { message?: string; error?: string } };
      if (!res.ok) return { ok: false, message: data.error?.message ?? data.error?.error ?? `HTTP ${res.status}` };
      return { ok: true, message: `Connected to ${provider} via server gateway`, preview: (data.response ?? '').slice(0, 200) };
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }
  }
}
