import assert from 'node:assert/strict';
import test from 'node:test';
import { GeminiProviderAdapter } from './gemini.adapter.ts';
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

test('streams text tokens from Gemini SSE frames', async () => {
  let capturedUrl = '';
  let capturedBody = '';
  const adapter = new GeminiProviderAdapter('fake-test-key', async (input, init) => {
    capturedUrl = String(input);
    capturedBody = String(init?.body);
    return sseResponse([
      'data: {"candidates":[{"content":{"parts":[{"text":"こんにちは"}]}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":"世界"}]}}]}\n\n',
    ], 200, { 'Content-Type': 'text/event-stream' });
  });

  const events = [];
  for await (const event of adapter.generate(makeRequest({
    system: 'Answer in Vietnamese.',
    temperature: 0.4,
    topK: 8,
  }), new AbortController().signal)) {
    events.push(event);
  }

  assert.deepEqual(events, [
    { type: 'token', token: 'こんにちは' },
    { type: 'token', token: '世界' },
    { type: 'done' },
  ]);
  assert.match(capturedUrl, /streamGenerateContent/);
  assert.match(capturedUrl, /key=fake-test-key/);
  assert.doesNotMatch(capturedBody, /fake-test-key/);
  const body = JSON.parse(capturedBody);
  assert.equal(body.systemInstruction.parts[0].text, 'Answer in Vietnamese.');
  assert.equal(body.generationConfig.temperature, 0.4);
  assert.equal(body.generationConfig.topK, 8);
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
