import assert from 'node:assert/strict';
import test from 'node:test';
import { GeminiProviderAdapter } from './gemini.adapter';
import type { AiChatGatewayRequest } from './contracts.ts';

function makeRequest(overrides: Partial<AiChatGatewayRequest> = {}): AiChatGatewayRequest {
  return {
    provider: 'gemini',
    model: 'gemini-test',
    prompt: 'Explain a Japanese grammar point.',
    stream: true,
    ...overrides,
  };
}

function sseResponse(chunks: string[], status = 200, headers?: HeadersInit): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status, headers });
}

test('returns a safe configuration error when server key is missing', async () => {
  const adapter = new GeminiProviderAdapter(undefined, async () => {
    throw new Error('fetch should not run');
  });
  const events = [];
  for await (const event of adapter.generate(makeRequest(), new AbortController().signal)) {
    events.push(event);
  }
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'error');
  if (events[0].type === 'error') {
    assert.equal(events[0].error.code, 'provider_not_configured');
    assert.equal(events[0].error.retryable, false);
  }
});

test('calls the Interactions API and extracts generated text', async () => {
  let capturedUrl = '';
  let capturedBody = '';
  let capturedApiKey = '';
  const adapter = new GeminiProviderAdapter('fake-test-key', async (input, init) => {
    capturedUrl = String(input);
    capturedBody = String(init?.body);
    capturedApiKey = new Headers(init?.headers).get('x-goog-api-key') ?? '';
    return new Response(JSON.stringify({ output_text: 'こんにちは世界' }), { status: 200 });
  });
  const events = [];
  for await (const event of adapter.generate(makeRequest({ system: 'Answer in Vietnamese.', model: 'gemini-3.8-flash' }), new AbortController().signal)) events.push(event);
  assert.deepEqual(events, [{ type: 'token', token: 'こんにちは世界' }, { type: 'done' }]);
  assert.equal(capturedUrl, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.equal(capturedApiKey, 'fake-test-key');
  const body = JSON.parse(capturedBody);
  assert.equal(body.model, 'gemini-3.8-flash');
  assert.equal(body.input, 'Answer in Vietnamese.\n\nExplain a Japanese grammar point.');
  assert.equal(body.generation_config.thinking_level, 'low');
  assert.doesNotMatch(capturedBody, /fake-test-key/);
});

test('returns a bounded timeout error when Gemini does not respond', async () => {
  const adapter = new GeminiProviderAdapter('fake', async (_input, init) => new Promise((_resolve, reject) => {
    const signal = init?.signal as AbortSignal;
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }), 5);
  const events = [];
  for await (const event of adapter.generate(makeRequest(), new AbortController().signal)) events.push(event);
  assert.equal(events[0].type, 'error');
  if (events[0].type === 'error') assert.equal(events[0].error.code, 'upstream_timeout');
});

test('maps rate limiting and retry-after without exposing credentials', async () => {
  const adapter = new GeminiProviderAdapter('secret-not-for-logs', async () =>
    new Response(JSON.stringify({ error: { message: 'private provider detail' } }), {
      status: 429,
      headers: { 'retry-after': '17' },
    }),
  );
  const events = [];
  for await (const event of adapter.generate(makeRequest(), new AbortController().signal)) {
    events.push(event);
  }
  assert.equal(events[0].type, 'error');
  if (events[0].type === 'error') {
    assert.equal(events[0].error.code, 'rate_limited');
    assert.equal(events[0].error.retryAfterSeconds, 17);
    assert.equal(events[0].error.message.includes('secret-not-for-logs'), false);
  }
});

test('maps server failures as retryable provider unavailability', async () => {
  const adapter = new GeminiProviderAdapter('fake', async () =>
    new Response('{}', { status: 503 }),
  );
  const events = [];
  for await (const event of adapter.generate(makeRequest(), new AbortController().signal)) {
    events.push(event);
  }
  assert.equal(events[0].type, 'error');
  if (events[0].type === 'error') {
    assert.equal(events[0].error.code, 'provider_unavailable');
    assert.equal(events[0].error.retryable, true);
  }
});

test('rejects images until vision forwarding is implemented', async () => {
  const adapter = new GeminiProviderAdapter('fake', async () => {
    throw new Error('fetch should not run');
  });
  const events = [];
  for await (const event of adapter.generate(makeRequest({
    images: [{ mimeType: 'image/png', data: 'YWJj' }],
  }), new AbortController().signal)) {
    events.push(event);
  }
  assert.equal(events[0].type, 'error');
  if (events[0].type === 'error') {
    assert.equal(events[0].error.code, 'unsupported_capability');
  }
});

test('reports text and streaming support but keeps vision disabled', () => {
  const adapter = new GeminiProviderAdapter('fake', fetch);
  assert.deepEqual(adapter.getCapabilities('gemini-test'), {
    text: true,
    vision: false,
    streaming: true,
  });
});