import { Injectable, inject } from '@angular/core';
import { AiProvider } from './ai-provider.interface';
import { LocalProvider } from './local.provider';
import { CloudProvider } from './cloud.provider';
import { AiProviderType } from '../models/ai-chat.model';

@Injectable({ providedIn: 'root' })
export class ProviderFactory {
  private readonly local = inject(LocalProvider);
  private readonly cloud = inject(CloudProvider);

  configureLocal(endpoint: string): void {
    this.local.setEndpoint(endpoint);
  }

  configureCloud(apiKey: string, model: string, proxyUrl?: string): void {
    this.cloud.configure({ apiKey, model, proxyUrl });
  }

  get(type: AiProviderType): AiProvider {
    if (type === 'cloud') return this.cloud;
    return this.local;
  }
}
