import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { AiSettingsService } from '../../services/ai-settings.service';
import { ProviderFactory } from '../../providers/provider-factory.service';
import { LocalProvider } from '../../providers/local.provider';
import { CloudProvider } from '../../providers/cloud.provider';
import { AiCloudProvider, AiProviderType } from '../../models/ai-chat.model';

const LOCAL_ENDPOINT = 'http://localhost:11434';
const CLOUD_GATEWAY_DISPLAY = '/api/ai-chat (Gemini / Groq server gateway)';
const CLOUD_MODELS: Record<AiCloudProvider, string> = {
  gemini: 'gemini-3.8-flash',
  groq: 'llama-3.3-70b-versatile',
};

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
  readonly isCloud = computed(() => this.settings().provider === 'cloud');
  readonly currentEndpoint = computed(() => this.isCloud() ? CLOUD_GATEWAY_DISPLAY : LOCAL_ENDPOINT);
  readonly testStatus = signal<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  readonly testMessage = signal('');
  readonly testResponse = signal('');
  readonly savedToast = signal(false);

  setProvider(provider: AiProviderType): void {
    this.settingsSvc.update({ provider });
    this.resetTest();
  }

  setCloudProvider(provider: AiCloudProvider): void {
    this.settingsSvc.update({ cloudProvider: provider, model: CLOUD_MODELS[provider] });
    this.resetTest();
  }

  setModel(model: string): void {
    this.settingsSvc.update({ model });
    this.resetTest();
  }

  save(): void {
    this.settingsSvc.update({ ...this.settings() });
    this.savedToast.set(true);
    setTimeout(() => this.savedToast.set(false), 2500);
  }

  resetDefaults(): void {
    this.settingsSvc.reset();
    this.resetTest();
  }

  async testConnection(): Promise<void> {
    this.testStatus.set('testing');
    this.testMessage.set('Đang kiểm tra kết nối...');
    this.testResponse.set('');
    this.factory.configureLocal(this.settings().localEndpoint || LOCAL_ENDPOINT);
    this.factory.configureCloud();
    const provider = this.isCloud() ? this.cloud : this.local;
    try {
      const result = await provider.testConnection?.();
      if (!result) {
        this.testStatus.set('ok');
        this.testMessage.set('Kết nối đã được kiểm tra.');
      } else if (result.ok) {
        this.testStatus.set('ok');
        this.testMessage.set('✅ ' + result.message);
        if (result.preview) this.testResponse.set(result.preview);
      } else {
        this.testStatus.set('fail');
        this.testMessage.set('❌ ' + result.message);
      }
    } catch (error) {
      this.testStatus.set('fail');
      this.testMessage.set('❌ ' + (error as Error).message);
    }
  }

  goBack(): void {
    void this.router.navigate(['/ai']);
  }

  private resetTest(): void {
    this.testStatus.set('idle');
    this.testMessage.set('');
    this.testResponse.set('');
  }
}