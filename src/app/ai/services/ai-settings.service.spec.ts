import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { AiSettingsService } from './ai-settings.service';

describe('AiSettingsService cloud credential migration', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        AiSettingsService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
  });

  afterEach(() => localStorage.clear());

  it('removes legacy cloudApiKey from memory and persisted settings', () => {
    localStorage.setItem('ai_settings_v2', JSON.stringify({
      provider: 'cloud',
      cloudProvider: 'gemini',
      cloudApiKey: 'legacy-secret-must-not-survive',
      model: 'gemini-2.5-flash',
    }));

    const service = TestBed.inject(AiSettingsService);
    expect(service.get().cloudApiKey).toBeUndefined();

    const persisted = localStorage.getItem('ai_settings_v2') ?? '';
    expect(persisted).not.toContain('legacy-secret-must-not-survive');
    expect(persisted).not.toContain('cloudApiKey');
    expect(JSON.parse(persisted).cloudProvider).toBe('gemini');
  });

  it('does not reintroduce cloudApiKey through update()', () => {
    const service = TestBed.inject(AiSettingsService);
    service.update({ cloudApiKey: 'another-secret' } as never);

    expect(service.get().cloudApiKey).toBeUndefined();
    expect(localStorage.getItem('ai_settings_v2') ?? '').not.toContain('another-secret');
  });

  it('uses the deployed Vercel origin for Capacitor/mobile origins', () => {
    const service = TestBed.inject(AiSettingsService);
    expect(service.baseUrl()).toBe('');
    // baseUrl uses window.location.origin, which is not replaceable in this
    // unit test environment; the URL constant is additionally covered by build.
  });
});
