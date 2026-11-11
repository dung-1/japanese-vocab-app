import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { CloudProvider } from './cloud.provider';
import { AiSettingsService } from '../services/ai-settings.service';

describe('CloudProvider gateway request', () => {
  let provider: CloudProvider;
  let settings: AiSettingsService;
  let fetchSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CloudProvider,
        AiSettingsService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    provider = TestBed.inject(CloudProvider);
    settings = TestBed.inject(AiSettingsService);
    settings.update({ provider: 'cloud', cloudProvider: 'gemini', model: 'gemini-2.5-flash' });
    fetchSpy = spyOn(window, 'fetch').and.returnValue(Promise.resolve(
      new Response(JSON.stringify({ response: 'hello' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ));
  });

  it('sends provider/model/prompt without any browser API key', async () => {
    const tokens: string[] = [];
    let completed = false;

    await provider.chat({
      model: 'gemini-2.5-flash',
      user: 'test prompt',
      system: 'test system',
      temperature: 0.3,
      topK: 5,
      stream: false,
    }, token => tokens.push(token), () => completed = true);

    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(url).toContain('/api/ai-chat');
    expect(body.provider).toBe('gemini');
    expect(body.model).toBe('gemini-2.5-flash');
    expect(body.prompt).toBe('test prompt');
    expect(body.system).toBe('test system');
    expect(Object.prototype.hasOwnProperty.call(body, 'apiKey')).toBeFalse();
    expect(Object.prototype.hasOwnProperty.call(body, 'cloudApiKey')).toBeFalse();
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(tokens).toEqual(['hello']);
    expect(completed).toBeTrue();
  });
});
