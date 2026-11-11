import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { createAiChatHandler } from './ai-chat.ts';
import type {
  AiGatewayStreamEvent,
  AiProviderAdapter,
} from './_lib/ai/contracts.ts';
import { StaticAiProviderRegistry } from './_lib/ai/provider-registry.ts';

function makeAdapter(
  events: AiGatewayStreamEvent[],
  onGenerate?: () => void,
): AiProviderAdapter {
  return {
    id: 'gemini',
    getCapabilities: () => ({ text: true, vision: false, streaming: true }),
    async *generate() {
      onGenerate?.();
      for (const event of events) yield event;
    },
  };
}

function mockRequest(method = 'POST', body: unknown = {
  provider: 'gemini',
  model: 'gemini-test',
  prompt: 'hello',
  stream: true,
}) {
  const req = new EventEmitter() as EventEmitter & {
    method: string;
    body: unknown;
    aborted: boolean;
    headers: Record<string, string>;
  };
  req.method = method;
  req.body = body;
  req.aborted = false;
  req.headers = {};
  return req;
}

function mockResponse() {
  const res = new EventEmitter() as EventEmitter & {
    statusCode?: number;
    headers: Record<string, string>;
    chunks: string[];
    body?: unknown;
    writableEnded: boolean;
    destroyed: boolean;
    headersSent: boolean;
    status(code: number): typeof res;
    setHeader(name: string, value: string): typeof res;
    json(value: unknown): typeof res;
    write(value: string): boolean;
    end(): typeof res;
  };
  res.headers = {};
  res.chunks = [];
  res.writableEnded = false;
  res.destroyed = false;
  res.headersSent = false;
  res.status = (code) => { res.statusCode = code; return res; };
  res.setHeader = (name, value) => { res.headers[name.toLowerCase()] = value; return res; };
  res.json = (value) => { res.body = value; res.headersSent = true; res.writableEnded = true; return res; };
  res.write = (value) => { res.chunks.push(value); res.headersSent = true; return true; };
  res.end = () => { res.writableEnded = true; return res; };
  return res;
}

function parseLines(res: ReturnType<typeof mockResponse>): unknown[] {
  return res.chunks.flatMap(chunk => chunk.split('\n').filter(Boolean).map(line => JSON.parse(line)));
}

test('answers OPTIONS preflight and rejects unsupported HTTP methods', async () => {
  const handler = createAiChatHandler();
  const optionsReq = mockRequest('OPTIONS');
  const optionsRes = mockResponse();
  await handler(optionsReq as never, optionsRes as never);
  assert.equal(optionsRes.statusCode, 204);
  assert.equal(optionsRes.writableEnded, true);

  const getReq = mockRequest('GET');
  const getRes = mockResponse();
  await handler(getReq as never, getRes as never);
  assert.equal(getRes.statusCode, 405);
  assert.deepEqual(getRes.body, {
    error: 'method_not_allowed',
    message: 'Only POST is supported',
  });
});

test('rejects malformed payload before calling any provider', async () => {
  let calls = 0;
  const handler = createAiChatHandler({
    createRegistry: () => new StaticAiProviderRegistry([makeAdapter([{ type: 'done' }], () => calls++)]),
  });
  const req = mockRequest('POST', { provider: 'unknown' });
  const res = mockResponse();
  await handler(req as never, res as never);
  assert.equal(res.statusCode, 400);
  assert.equal(calls, 0);
});

test('returns safe 503 when selected cloud provider has no server key', async () => {
  const handler = createAiChatHandler({
    env: { GEMINI_API_KEY: '', GROQ_API_KEY: '' },
  });
  const req = mockRequest();
  const res = mockResponse();
  await handler(req as never, res as never);
  assert.equal(res.statusCode, 503);
  assert.equal((res.body as { error: { code: string } }).error.code, 'provider_not_configured');
});

test('streams NDJSON tokens and completion marker', async () => {
  const handler = createAiChatHandler({
    createRegistry: () => new StaticAiProviderRegistry([
      makeAdapter([{ type: 'token', token: 'こんにちは' }, { type: 'token', token: '世界' }, { type: 'done' }]),
    ]),
    env: {},
  });
  const req = mockRequest();
  const res = mockResponse();
  await handler(req as never, res as never);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /application\/x-ndjson/);
  assert.deepEqual(parseLines(res), [
    { response: 'こんにちは' },
    { response: '世界' },
    { done: true },
  ]);
  assert.equal(res.writableEnded, true);
});

test('returns JSON when stream is false', async () => {
  const handler = createAiChatHandler({
    createRegistry: () => new StaticAiProviderRegistry([
      makeAdapter([{ type: 'token', token: 'answer' }, { type: 'done' }]),
    ]),
    env: {},
  });
  const req = mockRequest('POST', {
    provider: 'gemini',
    model: 'gemini-test',
    prompt: 'hello',
    stream: false,
  });
  const res = mockResponse();
  await handler(req as never, res as never);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { response: 'answer' });
});

test('maps provider failure to HTTP status without leaking secrets', async () => {
  const handler = createAiChatHandler({
    createRegistry: () => new StaticAiProviderRegistry([
      makeAdapter([{
        type: 'error',
        error: {
          code: 'rate_limited',
          message: 'Please retry.',
          retryable: true,
          provider: 'gemini',
        },
      }]),
    ]),
    env: {},
  });
  const req = mockRequest();
  const res = mockResponse();
  await handler(req as never, res as never);
  assert.equal(res.statusCode, 429);
  assert.deepEqual(res.body, {
    error: {
      error: 'Please retry.',
      code: 'rate_limited',
      retryable: true,
      provider: 'gemini',
    },
  });
});

test('emits an in-band NDJSON error after streaming has started', async () => {
  const handler = createAiChatHandler({
    createRegistry: () => new StaticAiProviderRegistry([
      makeAdapter([
        { type: 'token', token: 'partial' },
        {
          type: 'error',
          error: { code: 'provider_unavailable', message: 'unavailable', retryable: true },
        },
      ]),
    ]),
    env: {},
  });
  const req = mockRequest();
  const res = mockResponse();
  await handler(req as never, res as never);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(parseLines(res), [
    { response: 'partial' },
    { error: 'unavailable', code: 'provider_unavailable', retryable: true, provider: 'gemini' },
  ]);
  assert.equal(res.writableEnded, true);
});

test('rejects local provider on the cloud gateway', async () => {
  const handler = createAiChatHandler({ env: {} });
  const req = mockRequest('POST', {
    provider: 'local',
    model: 'qwen-local',
    prompt: 'hello',
  });
  const res = mockResponse();
  await handler(req as never, res as never);
  assert.equal(res.statusCode, 400);
  assert.equal((res.body as { error: { code: string } }).error.code, 'unsupported_capability');
});


test('allows configured production origin and echoes only that origin', async () => {
  const handler = createAiChatHandler({
    env: { AI_ALLOWED_ORIGINS: 'https://app.example.com,capacitor://localhost' },
    createRegistry: () => new StaticAiProviderRegistry([
      makeAdapter([{ type: 'token', token: 'ok' }, { type: 'done' }]),
    ]),
  });
  const req = mockRequest() as ReturnType<typeof mockRequest> & { headers: Record<string, string> };
  req.headers = { origin: 'https://app.example.com' };
  const res = mockResponse();
  await handler(req as never, res as never);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['access-control-allow-origin'], 'https://app.example.com');
  assert.equal(res.headers['vary'], 'Origin');
  assert.equal(res.headers['access-control-allow-headers'], 'Content-Type');
});

test('rejects untrusted browser origin before calling provider', async () => {
  let calls = 0;
  const handler = createAiChatHandler({
    env: { AI_ALLOWED_ORIGINS: 'https://app.example.com' },
    createRegistry: () => new StaticAiProviderRegistry([
      makeAdapter([{ type: 'done' }], () => calls++),
    ]),
  });
  const req = mockRequest() as ReturnType<typeof mockRequest> & { headers: Record<string, string> };
  req.headers = { origin: 'https://attacker.example' };
  const res = mockResponse();
  await handler(req as never, res as never);
  assert.equal(res.statusCode, 403);
  assert.equal((res.body as { error: string }).error, 'origin_not_allowed');
  assert.equal(res.headers['access-control-allow-origin'], undefined);
  assert.equal(calls, 0);
});

test('rejects untrusted CORS preflight', async () => {
  const handler = createAiChatHandler({
    env: { AI_ALLOWED_ORIGINS: 'https://app.example.com' },
  });
  const req = mockRequest('OPTIONS') as ReturnType<typeof mockRequest> & { headers: Record<string, string> };
  req.headers = { origin: 'https://attacker.example' };
  const res = mockResponse();
  await handler(req as never, res as never);
  assert.equal(res.statusCode, 403);
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});


test('rejects requests with a non-JSON content type', async () => {
  const handler = createAiChatHandler();
  const req = mockRequest() as ReturnType<typeof mockRequest> & { headers: Record<string, string> };
  req.headers['content-type'] = 'text/plain';
  const res = mockResponse();
  await handler(req as never, res as never);
  assert.equal(res.statusCode, 415);
});

test('rejects oversized request bodies before provider invocation', async () => {
  let calls = 0;
  const handler = createAiChatHandler({
    env: { AI_MAX_BODY_BYTES: '100' },
    createRegistry: () => new StaticAiProviderRegistry([
      makeAdapter([{ type: 'done' }], () => calls++),
    ]),
  });
  const req = mockRequest() as ReturnType<typeof mockRequest> & { headers: Record<string, string> };
  req.headers['content-type'] = 'application/json';
  const res = mockResponse();
  await handler(req as never, res as never);
  assert.equal(res.statusCode, 413);
  assert.equal((res.body as { error: string }).error, 'payload_too_large');
  assert.equal(calls, 0);
});
