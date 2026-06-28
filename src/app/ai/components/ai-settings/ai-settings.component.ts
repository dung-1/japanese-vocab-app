import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AiSettingsService } from '../../services/ai-settings.service';
import { ProviderFactory } from '../../providers/provider-factory.service';
import { LocalProvider } from '../../providers/local.provider';
import { CloudProvider } from '../../providers/cloud.provider';
import { AiProviderType } from '../../models/ai-chat.model';

/** Endpoint cố định theo provider — không cho user sửa. */
const LOCAL_ENDPOINT = 'http://localhost:11434';
/** Chỉ để HIỂN THỊ trong UI — không dùng làm proxyUrl. */
const CLOUD_UPSTREAM_DISPLAY = 'https://ollama.com/api/generate (via /api/chat proxy)';
/** Proxy endpoint trên cùng origin — CloudProvider gọi cái này. */
const CLOUD_PROXY_URL = '/api/chat';

@Component({
  selector: 'app-ai-settings',
  templateUrl: './ai-settings.component.html',
  styleUrls: ['./ai-settings.component.css'],
  standalone: false,
})
export class AiSettingsComponent {
  readonly settingsSvc = inject(AiSettingsService);
  private readonly factory = inject(ProviderFactory);
  private readonly local = inject(LocalProvider);
  private readonly cloud = inject(CloudProvider);
  private readonly router = inject(Router);

  readonly settings = this.settingsSvc.settings;

  /** Endpoint hiện tại tự động theo provider. */
  readonly currentEndpoint = computed(() =>
    this.settings().provider === 'cloud' ? CLOUD_UPSTREAM_DISPLAY : LOCAL_ENDPOINT,
  );

  /** Có đang dùng Cloud? */
  readonly isCloud = computed(() => this.settings().provider === 'cloud');

  readonly showApiKey = signal(false);
  readonly testStatus = signal<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  readonly testMessage = signal('');
  readonly testResponse = signal('');
  readonly savedToast = signal(false);

  setProvider(p: AiProviderType): void {
    this.settingsSvc.update({ provider: p });
    this.testStatus.set('idle');
    this.testMessage.set('');
    this.testResponse.set('');
  }

  toggleShowApiKey(): void {
    this.showApiKey.update((v) => !v);
  }

  save(): void {
    const s = this.settings();
    this.settingsSvc.update({ ...s });
    this.savedToast.set(true);
    setTimeout(() => this.savedToast.set(false), 2500);
  }

  resetDefaults(): void {
    this.settingsSvc.reset();
    this.testStatus.set('idle');
    this.testMessage.set('');
    this.testResponse.set('');
  }

  async testConnection(): Promise<void> {
    this.testStatus.set('testing');
    this.testMessage.set('Đang kết nối...');
    this.testResponse.set('');
    const s = this.settings();

    // Đồng bộ endpoint + config trước khi test
    // LOCAL: gọi trực tiếp Ollama local
    // CLOUD: luôn đi qua proxy /api/chat (same-origin) — tránh CORS
    this.factory.configureLocal(LOCAL_ENDPOINT);
    this.factory.configureCloud(s.cloudApiKey, s.model, CLOUD_PROXY_URL);

    const provider = s.provider === 'cloud' ? this.cloud : this.local;
    console.log('[AI Test] provider=', s.provider, 'endpoint=', this.currentEndpoint(), 'model=', s.model);

    try {
      const result = (await provider.testConnection?.()) as { ok: boolean; message: string; preview?: string } | undefined;
      if (!result) {
        this.testStatus.set('ok');
        this.testMessage.set('OK');
        return;
      }
      if (result.ok) {
        this.testStatus.set('ok');
        this.testMessage.set('✅ ' + result.message);
        if (result.preview) this.testResponse.set(result.preview);
      } else {
        this.testStatus.set('fail');
        this.testMessage.set('❌ ' + result.message);
      }
    } catch (e) {
      const err = e as Error;
      console.error('[AI Test] error:', err);
      this.testStatus.set('fail');
      this.testMessage.set('❌ ' + err.message);
    }
  }

  goBack(): void {
    this.router.navigate(['/ai']);
  }
}