import { Injectable, inject } from '@angular/core';
import { AiProvider } from './ai-provider.interface';
import { LocalProvider } from './local.provider';
import { CloudProvider } from './cloud.provider';
import { AiProviderType } from '../models/ai-chat.model';

@Injectable({ providedIn: 'root' })
export class ProviderFactory {
  private readonly local = inject(LocalProvider);
  private readonly cloud = inject(CloudProvider);

  private _activeType: AiProviderType = 'local';

  configureLocal(endpoint: string): void {
    this.local.setEndpoint(endpoint);
  }

  configureCloud(): void {
    // Cloud credentials are server-side; the browser sends provider/model only.
  }

  setActiveType(type: AiProviderType): void {
    this._activeType = type;
  }

  get(type: AiProviderType): AiProvider {
    if (type === 'cloud') return this.cloud;
    return this.local;
  }

  /**
   * Trả về provider đang active.
   * EmbeddingService gọi getProvider() — cần setActiveType() trước.
   */
  getProvider(): AiProvider {
    return this.get(this._activeType);
  }
}
