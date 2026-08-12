import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AiSettingsService } from '../../services/ai-settings.service';
import { ProviderFactory } from '../../providers/provider-factory.service';
import { LocalProvider } from '../../providers/local.provider';
import { CloudProvider } from '../../providers/cloud.provider';
import { AiProviderType } from '../../models/ai-chat.model';
import { OllamaCloudModel } from '../../models/ollama-model.model';

const LOCAL_ENDPOINT = 'http://localhost:11434';
const CLOUD_UPSTREAM_DISPLAY = 'https://ollama.com/api/generate (via /api/chat proxy)';
const CLOUD_PROXY_URL = '/api/chat';

@Component({
  selector: 'app-ai-settings',
  templateUrl: './ai-settings.component.html',
  styleUrls: ['./ai-settings.component.css'],
  standalone: false,
})
export class AiSettingsComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  readonly settingsSvc = inject(AiSettingsService);
  private readonly factory = inject(ProviderFactory);
  private readonly local = inject(LocalProvider);
  private readonly cloud = inject(CloudProvider);
  private readonly router = inject(Router);

  readonly settings = this.settingsSvc.settings;

  readonly currentEndpoint = computed(() =>
    this.settings().provider === 'cloud' ? CLOUD_UPSTREAM_DISPLAY : LOCAL_ENDPOINT,
  );

  readonly isCloud = computed(() => this.settings().provider === 'cloud');

  // ── Model selector ──────────────────────────────────────────────────────────

  readonly cloudModels = signal<OllamaCloudModel[]>([]);
  readonly modelsLoading = signal(false);
  readonly modelsError = signal(false);
  readonly modelsSource = signal<string>('');

  readonly selectedModelDesc = computed(() =>
    this.cloudModels().find((m) => m.tag === this.settings().model)?.description ?? ''
  );

  readonly selectedModelTags = computed(() =>
    this.cloudModels().find((m) => m.tag === this.settings().model)?.tags ?? []
  );

  // ── UI state ────────────────────────────────────────────────────────────────

  readonly showApiKey = signal(false);
  readonly testStatus = signal<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  readonly testMessage = signal('');
  readonly testResponse = signal('');
  readonly savedToast = signal(false);

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      void this.loadCloudModels();
    }
  }

  // ── Cloud model fetch ───────────────────────────────────────────────────────

  async loadCloudModels(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    this.modelsLoading.set(true);
    this.modelsError.set(false);
    try {
      const baseUrl = this.settingsSvc.baseUrl();
      const resp = await fetch(`${baseUrl}/api/ollama-cloud-models`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as { models: OllamaCloudModel[]; source?: string };
      this.cloudModels.set(data.models ?? []);
      this.modelsSource.set(data.source ?? '');
    } catch (e) {
      console.warn('[ai-settings] loadCloudModels error', e);
      this.modelsError.set(true);
    } finally {
      this.modelsLoading.set(false);
    }
  }

  // ── Settings ops ────────────────────────────────────────────────────────────

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
    this.settingsSvc.update({ ...this.settings() });
    this.savedToast.set(true);
    setTimeout(() => this.savedToast.set(false), 2500);
  }

  resetDefaults(): void {
    this.settingsSvc.reset();
    this.testStatus.set('idle');
    this.testMessage.set('');
    this.testResponse.set('');
  }

  // ── Test connection ──────────────────────────────────────────────────────────

  async testConnection(): Promise<void> {
    this.testStatus.set('testing');
    this.testMessage.set('Đang kết nối...');
    this.testResponse.set('');
    const s = this.settings();

    this.factory.configureLocal(LOCAL_ENDPOINT);
    this.factory.configureCloud(s.cloudApiKey, s.model, CLOUD_PROXY_URL);

    const provider = s.provider === 'cloud' ? this.cloud : this.local;

    try {
      const result = (await provider.testConnection?.()) as
        | { ok: boolean; message: string; preview?: string }
        | undefined;
      if (!result) { this.testStatus.set('ok'); this.testMessage.set('OK'); return; }
      if (result.ok) {
        this.testStatus.set('ok');
        this.testMessage.set('✅ ' + result.message);
        if (result.preview) this.testResponse.set(result.preview);
      } else {
        this.testStatus.set('fail');
        this.testMessage.set('❌ ' + result.message);
      }
    } catch (e) {
      this.testStatus.set('fail');
      this.testMessage.set('❌ ' + (e as Error).message);
    }
  }

  goBack(): void {
    void this.router.navigate(['/ai']);
  }
}
