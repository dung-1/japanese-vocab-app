import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  AiChatGatewayRequest,
  AiGatewayError,
  AiGatewayStreamEvent,
  AiProviderAdapter,
} from './contracts.ts';
import {
  generateWithFallback,
  StaticAiProviderRegistry,
} from './provider-registry';

function request(provider: 'gemini' | 'groq' = 'gemini'): AiChatGatewayRequest {
  return { provider, model: 'test-model', prompt: 'hello', stream: true };
}

function adapter(
  id: 'gemini' | 'groq',
  events: AiGatewayStreamEvent[],
  onGenerate?: () => void,
): AiProviderAdapter {
  return {
    id,
    getCapabilities: () => ({ text: true, vision: false, streaming: true }),
    async *generate() {
      onGenerate?.();
      for (const event of events) yield event;
    },
  };
}

async function collect(
  req: AiChatGatewayRequest,
  adapters: AiProviderAdapter[],
  fallbackOrder: Partial<Record<'gemini' | 'groq', Array<'gemini' | 'groq'>>>,
  signal = new AbortController().signal,
): Promise<AiGatewayStreamEvent[]> {
  const result: AiGatewayStreamEvent[] = [];
  for await (const event of generateWithFallback(
    req,
    signal,
    new StaticAiProviderRegistry(adapters),
    { fallbackOrder },
  )) result.push(event);
  return result;
}

const temporaryError: AiGatewayError = {
  code: 'rate_limited',
  message: 'retry later',
  retryable: true,
  provider: 'gemini',
};

test('falls back from Gemini to Groq on retryable error before first token', async () => {
  let groqCalls = 0;
  const events = await collect(
    request(),
    [
      adapter('gemini', [{ type: 'error', error: temporaryError }]),
      adapter('groq', [{ type: 'token', token: 'ok' }, { type: 'done' }], () => groqCalls++),
    ],
    { gemini: ['groq'] },
  );
  assert.equal(groqCalls, 1);
  assert.deepEqual(events, [{ type: 'token', token: 'ok' }, { type: 'done' }]);
});

test('does not fallback on authentication/provider rejection', async () => {
  let groqCalls = 0;
  const events = await collect(
    request(),
    [
      adapter('gemini', [{
        type: 'error',
        error: { code: 'provider_rejected', message: 'bad key', retryable: false },
      }]),
      adapter('groq', [{ type: 'done' }], () => groqCalls++),
    ],
    { gemini: ['groq'] },
  );
  assert.equal(groqCalls, 0);
  assert.equal(events[0].type, 'error');
  if (events[0].type === 'error') assert.equal(events[0].error.code, 'provider_rejected');
});

test('does not fallback after any partial token has been emitted', async () => {
  let groqCalls = 0;
  const events = await collect(
    request(),
    [
      adapter('gemini', [
        { type: 'token', token: 'partial' },
        { type: 'error', error: temporaryError },
      ]),
      adapter('groq', [{ type: 'token', token: 'duplicate' }, { type: 'done' }], () => groqCalls++),
    ],
    { gemini: ['groq'] },
  );
  assert.equal(groqCalls, 0);
  assert.deepEqual(events.map(event => event.type), ['token', 'error']);
});

test('does not fallback when selected provider is missing', async () => {
  let groqCalls = 0;
  const events = await collect(
    request(),
    [adapter('groq', [{ type: 'done' }], () => groqCalls++)],
    { gemini: ['groq'] },
  );
  assert.equal(groqCalls, 0);
  assert.equal(events[0].type, 'error');
  if (events[0].type === 'error') assert.equal(events[0].error.code, 'provider_not_configured');
});

test('skips unavailable fallback adapter after retryable primary error and reports last failure', async () => {
  const events = await collect(
    request(),
    [adapter('gemini', [{ type: 'error', error: temporaryError }])],
    { gemini: ['groq'] },
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'error');
  if (events[0].type === 'error') assert.equal(events[0].error.code, 'provider_not_configured');
});

test('does not fallback after caller aborts', async () => {
  const controller = new AbortController();
  controller.abort();
  let geminiCalls = 0;
  let groqCalls = 0;
  const events = await collect(
    request(),
    [
      adapter('gemini', [{ type: 'error', error: temporaryError }], () => geminiCalls++),
      adapter('groq', [{ type: 'done' }], () => groqCalls++),
    ],
    { gemini: ['groq'] },
    controller.signal,
  );
  assert.equal(geminiCalls, 0);
  assert.equal(groqCalls, 0);
  assert.deepEqual(events, []);
});

test('does not use a fallback lacking the requested capability', async () => {
  let groqCalls = 0;
  const noVisionGroq: AiProviderAdapter = {
    id: 'groq',
    getCapabilities: () => ({ text: true, vision: false, streaming: true }),
    async *generate() { groqCalls++; yield { type: 'done' }; },
  };
  const events = await collect(
    { ...request(), images: [{ mimeType: 'image/png', data: 'YWJj' }] },
    [
      adapter('gemini', [{ type: 'error', error: temporaryError }]),
      noVisionGroq,
    ],
    { gemini: ['groq'] },
  );
  assert.equal(groqCalls, 0);
  assert.equal(events[0].type, 'error');
  if (events[0].type === 'error') assert.equal(events[0].error.code, 'unsupported_capability');
});
