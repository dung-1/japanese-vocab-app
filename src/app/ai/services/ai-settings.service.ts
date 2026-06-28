import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AiSettings, DEFAULT_AI_SETTINGS } from '../models/ai-chat.model';

const STORAGE_KEY = 'ai_settings_v2';

@Injectable({ providedIn: 'root' })
export class AiSettingsService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly _settings = signal<AiSettings>(this.load());

  readonly settings = this._settings.asReadonly();
  readonly provider = computed(() => this._settings().provider);
  readonly model = computed(() => this._settings().model);
  readonly streaming = computed(() => this._settings().streaming);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Listen for storage events from other tabs
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            this._settings.set({ ...DEFAULT_AI_SETTINGS, ...parsed });
          } catch {
            // ignore
          }
        }
      });
    }
  }

  update(patch: Partial<AiSettings>): void {
    const next = { ...this._settings(), ...patch };
    this._settings.set(next);
    this.persist(next);
  }

  reset(): void {
    this._settings.set({ ...DEFAULT_AI_SETTINGS });
    this.persist(DEFAULT_AI_SETTINGS);
  }

  get(): AiSettings {
    return this._settings();
  }

  private load(): AiSettings {
    if (!isPlatformBrowser(this.platformId)) {
      return { ...DEFAULT_AI_SETTINGS };
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_AI_SETTINGS };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_AI_SETTINGS, ...parsed };
    } catch {
      return { ...DEFAULT_AI_SETTINGS };
    }
  }

  private persist(s: AiSettings): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      // ignore quota errors
    }
  }
}
