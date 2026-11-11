import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateAiChatRequest,
  type AiGatewayErrorCode,
} from './contracts.ts';

test('accepts a minimal Gemini text request and applies safe defaults later', () => {
  const result = validateAiChatRequest({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    prompt: 'Explain 間に in Vietnamese.',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.request.provider, 'gemini');
    assert.equal(result.request.model, 'gemini-2.5-flash');
    assert.equal(result.request.prompt, 'Explain 間に in Vietnamese.');
    assert.equal(result.request.stream, undefined);
  }
});

test('accepts Groq and local provider identifiers', () => {
  for (const provider of ['groq', 'local']) {
    const result = validateAiChatRequest({
      provider,
      model: 'test-model',
      prompt: 'hello',
    });
    assert.equal(result.ok, true, provider);
  }
});

test('rejects unsupported provider and malformed request', () => {
  const cases: unknown[] = [
    null,
    [],
    { provider: 'ollama-cloud', model: 'x', prompt: 'hello' },
    { provider: 'gemini', model: '', prompt: 'hello' },
    { provider: 'gemini', model: 'x', prompt: '  ' },
    { provider: 'gemini', model: 'x', prompt: 'hello', temperature: 2.1 },
    { provider: 'gemini', model: 'x', prompt: 'hello', topK: 1.5 },
    { provider: 'gemini', model: 'x', prompt: 'hello', stream: 'yes' },
  ];

  for (const value of cases) {
    const result = validateAiChatRequest(value);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code satisfies AiGatewayErrorCode, 'invalid_request');
  }
});

test('rejects image payloads with unsupported MIME, invalid data, or too many images', () => {
  const base = { provider: 'gemini', model: 'vision-model', prompt: 'describe' };
  const invalidImages: unknown[] = [
    [{ mimeType: 'image/svg+xml', data: 'abc' }],
    [{ mimeType: 'image/png', data: '' }],
    [{ mimeType: 'image/png', data: 123 }],
    Array.from({ length: 5 }, () => ({ mimeType: 'image/png', data: 'YWJj' })),
  ];

  for (const images of invalidImages) {
    const result = validateAiChatRequest({ ...base, images });
    assert.equal(result.ok, false);
  }
});

test('accepts bounded image input for the future vision phase', () => {
  const result = validateAiChatRequest({
    provider: 'gemini',
    model: 'vision-model',
    prompt: 'Describe this picture.',
    images: [{ mimeType: 'image/jpeg', data: 'YWJj' }],
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.request.images?.[0].mimeType, 'image/jpeg');
});
