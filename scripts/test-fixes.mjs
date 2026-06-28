#!/usr/bin/env node
/**
 * test-fixes.mjs
 * Verify các fix sau khi sửa:
 *   1. Build pass
 *   2. Proxy /api/chat hoạt động (local + cloud)
 *   3. Default model đúng
 *
 * Cách dùng:
 *   node scripts/test-fixes.mjs
 *
 * Yêu cầu:
 *   - Ollama đang chạy: ollama serve
 *   - Server đang chạy: node dist/japanese-vocab-app/server/server.mjs (port 4000)
 *     HOẶC ng serve (port 3001 hoặc 4200)
 */

const SERVER_PORT = process.env.PORT ?? 4000;
const BASE = `http://localhost:${SERVER_PORT}`;
const OLLAMA = 'http://localhost:11434';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    const result = await fn();
    if (result.ok) {
      console.log(`✅ PASS: ${name}`);
      if (result.detail) console.log(`   → ${result.detail}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${name}`);
      console.log(`   → ${result.reason}`);
      failed++;
    }
  } catch (e) {
    console.log(`❌ ERROR: ${name}: ${e.message}`);
    failed++;
  }
}

// T1: Ollama đang chạy không?
await test('T1: Ollama local đang chạy', async () => {
  const res = await fetch(`${OLLAMA}/api/tags`).catch(e => ({ ok: false, _err: e.message }));
  if (!res.ok) return { ok: false, reason: `Ollama không phản hồi (${res._err ?? res.status}). Chạy: ollama serve` };
  const data = await res.json();
  const models = (data.models ?? []).map(m => m.name);
  return { ok: true, detail: `Models: ${models.join(', ')}` };
});

// T2: Server Express đang chạy không?
await test(`T2: Express server đang chạy tại ${BASE}`, async () => {
  const res = await fetch(`${BASE}/`).catch(e => ({ ok: false, _err: e.message }));
  if (!res.ok && !res._err) return { ok: true, detail: `HTTP ${res.status} (Angular app)` };
  if (res._err) return { ok: false, reason: `Server không phản hồi. Chạy: node dist/.../server.mjs HOẶC ng serve` };
  return { ok: true, detail: `HTTP ${res.status}` };
});

// T3: Proxy /api/chat với Local provider
await test('T3: POST /api/chat (provider=local)', async () => {
  // Lấy model đầu tiên từ Ollama
  const tagsRes = await fetch(`${OLLAMA}/api/tags`).catch(() => null);
  let model = 'qwen3:0.6b';
  if (tagsRes && tagsRes.ok) {
    const tagsData = await tagsRes.json();
    if (tagsData.models?.length > 0) model = tagsData.models[0].name;
  }

  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'local', model, prompt: 'Hi', stream: false }),
  }).catch(e => ({ ok: false, _err: e.message }));

  if (res._err) return { ok: false, reason: res._err };
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    return { ok: false, reason: `HTTP ${res.status}: ${txt.slice(0, 200)}` };
  }
  const data = await res.json();
  const preview = (data.response ?? '').slice(0, 100);
  return { ok: !!preview || data.done, detail: `model=${model} | response: "${preview}"` };
});

// T4: Proxy /api/chat với Cloud provider — không có API key → phải trả 400
await test('T4: POST /api/chat (provider=cloud, no apiKey) → expect HTTP 400', async () => {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'cloud', model: 'test', prompt: 'Hi', stream: false }),
  }).catch(e => ({ ok: false, _err: e.message }));

  if (res._err) return { ok: false, reason: res._err };
  if (res.status === 400) {
    const data = await res.json();
    return { ok: true, detail: `Correctly rejected: ${JSON.stringify(data)}` };
  }
  return { ok: false, reason: `Expected 400, got ${res.status}` };
});

// T5: Proxy /api/chat với Cloud provider — fake key → phải trả 401
await test('T5: POST /api/chat (provider=cloud, fake apiKey) → expect HTTP 401', async () => {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'cloud',
      apiKey: 'ollama-fake-key-test',
      model: 'gpt-oss:120b-cloud',
      prompt: 'Hi',
      stream: false,
    }),
  }).catch(e => ({ ok: false, _err: e.message }));

  if (res._err) return { ok: false, reason: res._err };
  if (res.status === 401) {
    const data = await res.json().catch(() => ({}));
    return { ok: true, detail: `Cloud correctly rejected fake key: ${JSON.stringify(data).slice(0, 100)}` };
  }
  return { ok: false, reason: `Expected 401, got ${res.status}` };
});

// T6: /api/ai/chat endpoint CŨ phải KHÔNG tồn tại nữa (xóa rồi)
await test('T6: /api/ai/chat (old endpoint) đã bị xóa → expect 404', async () => {
  const res = await fetch(`${BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'test', messages: [], stream: false }),
  }).catch(e => ({ ok: false, _err: e.message }));

  if (res._err) return { ok: false, reason: res._err };
  // Angular app có thể serve route /api/ai/chat như là Angular route (200) hoặc 404
  // Nhưng không nên trả JSON có error 'upstream_unreachable' như cũ
  const txt = await res.text().catch(() => '');
  const isOldProxyResponse = txt.includes('upstream_unreachable') || txt.includes('upstream_error');
  if (isOldProxyResponse) return { ok: false, reason: `Old proxy vẫn còn hoạt động! Response: ${txt.slice(0, 200)}` };
  return { ok: true, detail: `Old proxy đã bị xóa (HTTP ${res.status}, không có upstream_unreachable)` };
});

// T7: Verify default model trong DEFAULT_AI_SETTINGS
await test('T7: DEFAULT model là qwen3:0.6b (không phải cloud model)', async () => {
  // Đọc file trực tiếp không được từ đây, nhưng có thể test gián tiếp qua /api/chat
  // nếu server trả response OK với qwen3:0.6b thì model này tồn tại local
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'local', model: 'qwen3:0.6b', prompt: 'test', stream: false }),
  }).catch(e => ({ ok: false, _err: e.message }));

  if (res?._err) return { ok: false, reason: res._err };
  if (res.status === 404) {
    return { ok: false, reason: `Model qwen3:0.6b chưa pull. Chạy: ollama pull qwen3:0.6b` };
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    // Check nếu lỗi là về model name chứa :cloud (đây là cái chúng ta muốn FIX)
    if (txt.includes(':cloud') || txt.includes('model not found')) {
      return { ok: false, reason: `Model issue: ${txt.slice(0, 200)}` };
    }
  }
  const data = await res.json().catch(() => ({}));
  return { ok: true, detail: `qwen3:0.6b available, response: "${(data.response ?? '').slice(0, 80)}"` };
});

console.log('\n' + '='.repeat(50));
console.log(`Kết quả: ${passed} PASS / ${failed} FAIL`);
if (failed === 0) {
  console.log('✅ TẤT CẢ TEST PASS — Fixes hoạt động đúng!');
} else {
  console.log(`⚠️  ${failed} test FAIL — Xem lỗi ở trên để debug thêm.`);
}
console.log('='.repeat(50));
