import assert from 'node:assert/strict';
import test from 'node:test';
import { GroqProviderAdapter } from './groq.adapter';
import type { AiChatGatewayRequest } from './contracts.ts';

function request(overrides: Partial<AiChatGatewayRequest> = {}): AiChatGatewayRequest {
  return {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    prompt: 'Explain this Japanese sentence in Vietnamese.',
    stream: true,
    ...overrides,
  };
}

function sse(chunks: string[], status = 200, headers?: HeadersInit): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status, headers });
}

test('returns configuration error without calling upstream when key is missing', async () => {
  let called = false;
  const adapter = new GroqProviderAdapter(undefined, async () => {
    called = true;
    throw new Error('should not call');
  });
  const events = [];
  for await (const event of adapter.generate(request(), new AbortController().signal)) events.push(event);
  assert.equal(called, false);
  assert.equal(events[0].type, 'error');
  if (events[0].type === 'error') assert.equal(events[0].error.code, 'provider_not_configured');
});

test('streams content and sends system/user messages with server bearer auth', async () => {
  let auth = '';
  let bodyText = '';
  let url = '';
  const adapter = new GroqProviderAdapter('fake-groq-key', async (input, init) => {
    url = String(input);
    auth = new Headers(init?.headers).get('authorization') ?? '';
    bodyText = String(init?.body);
    return sse([
      'data: {"choices":[{"delta":{"content":"日本語"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"の勉強"}}]}\n\n',
      'data: [DONE]\n\n',
    ], 200, { 'Content-Type': 'text/event-stream' });
  });

  const events = [];
  for await (const event of adapter.generate(request({
    system: 'Answer in Vietnamese.',
    temperature: 0.3,
    topK: 10,
  }), new AbortController().signal)) events.push(event);

  assert.deepEqual(events, [
    { type: 'token', token: '日本語' },
    { type: 'token', token: 'の勉強' },
    { type: 'done' },
  ]);
  assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(auth, 'Bearer fake-groq-key');
  assert.doesNotMatch(bodyText, /fake-groq-key/);
  const body = JSON.parse(bodyText);
  assert.equal(body.messages[0].role, 'system');
  assert.equal(body.messages[1].role, 'user');
  assert.equal(body.temperature, 0.3);
  assert.equal(Object.hasOwn(body, 'top_k'), false);
  assert.equal(body.stream, true);
});

test('maps 429 to retryable rate limit with bounded retry-after', async () => {
  const adapter = new GroqProviderAdapter('fake', async () =>
    new Response(JSON.stringify({ error: { message: 'private upstream detail' } }), {
      status: 429,
      headers: { 'retry-after': '45' },
    }),
  );
  const events = [];
  for await (const event of adapter.generate(request(), new AbortController().signal)) events.push(event);
  assert.equal(events[0].type, 'error');
  if (events[0].type === 'error') {
    assert.equal(events[0].error.code, 'rate_limited');
    assert.equal(events[0].error.retryable, true);
    assert.equal(events[0].error.retryAfterSeconds, 45);
    assert.doesNotMatch(events[0].error.message, /fake/);
  }
});

test('maps 5xx to retryable unavailability and 401 to non-retryable rejection', async () => {
  for (const [status, code, retryable] of [
    [503, 'provider_unavailable', true],
    [401, 'provider_rejected', false],
  ] as const) {
    const adapter = new GroqProviderAdapter('fake', async () =>
      new Response(JSON.stringify({ error: { message: 'upstream response' } }), { status }),
    );
    const events = [];
    for await (const event of adapter.generate(request(), new AbortController().signal)) events.push(event);
    assert.equal(events[0].type, 'error');
    if (events[0].type === 'error') {
      assert.equal(events[0].error.code, code);
      assert.equal(events[0].error.retryable, retryable);
    }
  }
});

test('rejects image input until vision support is explicitly implemented', async () => {
  let called = false;
  const adapter = new GroqProviderAdapter('fake', async () => {
    called = true;
    throw new Error('should not call');
  });
  const events = [];
  for await (const event of adapter.generate(request({
    images: [{ mimeType: 'image/png', data: 'YWJj' }],
  }), new AbortController().signal)) events.push(event);
  assert.equal(called, false);
  assert.equal(events[0].type, 'error');
  if (events[0].type === 'error') assert.equal(events[0].error.code, 'unsupported_capability');
});

test('reports text and streaming capability, but no vision capability', () => {
  const adapter = new GroqProviderAdapter('fake', fetch);
  assert.deepEqual(adapter.getCapabilities('any-model'), {
    text: true,
    vision: false,
    streaming: true,
  });
});
