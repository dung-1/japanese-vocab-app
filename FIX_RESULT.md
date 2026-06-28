# FIX_RESULT

> Báo cáo kết quả sửa lỗi
> Ngày: 2026-06-28
> Dựa trên: AUDIT_REPORT.md → FIX_PLAN.md

---

## Tổng quan

| Fix | File | Trạng thái |
|---|---|---|
| #1 Cloud proxyUrl sai | `ai-settings.component.ts` | ✅ Done |
| #2 Default model cloud → local | `ai-chat.model.ts`, `environment.ts`, `environment.prod.ts` | ✅ Done |
| #3 Migration localStorage cũ | `ai-settings.service.ts` | ✅ Done |
| #4 Xóa `/api/ai/chat` cũ | `server.ts` | ✅ Done |
| #5 Local fallback qua proxy | `local.provider.ts` | ✅ Done |

---

## Chi tiết từng fix

### Fix #1 — ai-settings.component.ts

**TRƯỚC (BUG):**
```typescript
const CLOUD_ENDPOINT = 'https://ollama.com/api/generate';
// ...
this.factory.configureCloud(s.cloudApiKey, s.model, CLOUD_ENDPOINT);
// → CloudProvider.proxyUrl = 'https://ollama.com/api/generate'
// → Browser gọi thẳng Ollama Cloud → CORS → "Failed to fetch"
```

**SAU (FIX):**
```typescript
const CLOUD_UPSTREAM_DISPLAY = 'https://ollama.com/api/generate (via /api/chat proxy)';
const CLOUD_PROXY_URL = '/api/chat';
// ...
this.factory.configureCloud(s.cloudApiKey, s.model, CLOUD_PROXY_URL);
// → CloudProvider.proxyUrl = '/api/chat' (same-origin)
// → Browser gọi /api/chat → Express proxy → Ollama Cloud ✅
```

---

### Fix #2 — DEFAULT model

**TRƯỚC (BUG):**
```typescript
// ai-chat.model.ts
model: 'nemotron-3-super:cloud',   // Cloud model → 404 ở local Ollama

// environment.ts / environment.prod.ts
model: 'nemotron-3-super:cloud',
```

**SAU (FIX):**
```typescript
// ai-chat.model.ts
model: 'qwen3:0.6b',   // Đã pull, 522 MB, hoạt động ✅

// environment.ts
model: 'qwen3:0.6b',
cloudModel: 'nemotron-3-super:cloud',
ollamaProxy: '/api/chat',   // Updated từ '/api/ai/chat' → '/api/chat'
```

---

### Fix #3 — Migration localStorage

**Lý do:** User đã lưu `model: 'nemotron-3-super:cloud'` trong localStorage → merge `{...DEFAULT, ...parsed}` vẫn dùng model cũ dù DEFAULT đã đổi.

**Fix:**
```typescript
// ai-settings.service.ts — trong hàm load()
const CLOUD_MODEL_SUFFIXES = [':cloud', '-cloud'];
const isCloudModelName = CLOUD_MODEL_SUFFIXES.some(s => (merged.model ?? '').endsWith(s));
if (merged.provider === 'local' && isCloudModelName) {
  merged.model = DEFAULT_AI_SETTINGS.model;  // reset về 'qwen3:0.6b'
}
```

---

### Fix #4 — server.ts dọn endpoint cũ

**TRƯỚC:** `server.ts` có 2 route:
- `POST /api/chat` (mới, local + cloud)
- `POST /api/ai/chat` (cũ, local only)

**SAU:** Chỉ còn `POST /api/chat`. Import `httpRequest` từ `node:http` (dùng bởi `/api/ai/chat`) cũng bị xóa.

---

### Fix #5 — LocalProvider fallback qua proxy

**Lý do:** Một số môi trường (Capacitor Android, browser extension block) không fetch được `localhost:11434` trực tiếp.

**Fix:** Nếu direct fetch throws `TypeError` (Failed to fetch), tự động fallback sang `/api/chat` proxy:
```typescript
} catch (e) {
  if (err.name === 'TypeError' || err.message.includes('Failed to fetch')) {
    return this.chatViaProxy(request, ...);  // fallback
  }
}
```

---

## Files đã thay đổi

| File | Loại thay đổi |
|---|---|
| `src/app/ai/components/ai-settings/ai-settings.component.ts` | Fix BUG #1 |
| `src/app/ai/models/ai-chat.model.ts` | Fix BUG #2 |
| `src/app/ai/services/ai-settings.service.ts` | Fix #3 migration |
| `src/app/ai/providers/local.provider.ts` | Fix #5 fallback |
| `src/server.ts` | Fix #4 xóa /api/ai/chat |
| `src/environments/environment.ts` | Fix #2 model + proxy path |
| `src/environments/environment.prod.ts` | Fix #2 model + proxy path |
| `scripts/test-fixes.mjs` | MỚI — test script |

---

## Hướng dẫn verify

### Bước 1: Build
```powershell
cd H:\Scripts\japanese-vocab-app
ng build --configuration production
# Expect: exit 0, 0 errors
```

### Bước 2: Khởi động server
```powershell
node dist/japanese-vocab-app/server/server.mjs
# Expect: "Node Express server listening on http://localhost:4000"
```

### Bước 3: Chạy test script
```powershell
node scripts/test-fixes.mjs
# Expect: 7/7 PASS (hoặc T7 fail nếu qwen3:0.6b chưa pull)
```

### Bước 4: Test thủ công trong browser
1. Mở `http://localhost:4000/ai/settings`
2. Chọn **🏠 Ollama Local** → click **🧪 Test Connection**
   - Expect: `✅ Connected to http://localhost:11434`
3. Chọn **☁️ Ollama Cloud** → nhập API Key → click **🧪 Test Connection**
   - Expect: `✅ Connected to Ollama Cloud`
   - KHÔNG còn thấy `Failed to fetch` ← đây là fix chính
4. Vào `http://localhost:4000/ai` → hỏi "Kanji 食 nghĩa là gì?"
   - Expect: response stream về, có citation

---

## Success criteria

| Tiêu chí | Expect |
|---|---|
| Local Test Connection | ✅ Connected |
| Cloud Test Connection | ✅ Connected (không còn Failed to fetch) |
| Chat với Local | Streaming response ✅ |
| Chat với Cloud | Streaming response ✅ |
| No CORS errors | ✅ (Cloud đi qua /api/chat proxy) |
| Browser console | Không có TypeError: Failed to fetch |
