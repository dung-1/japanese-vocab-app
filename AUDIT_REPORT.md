# AUDIT_REPORT

> Senior Full Stack Debug Engineer — Kiểm toán toàn diện dự án
> Ngày: 2026-06-28
> Phạm vi: Phase 1 — ĐỌC & PHÂN TÍCH — CHƯA SỬA CODE
> Trạng thái: ✅ Audit hoàn thành — Sẵn sàng chuyển sang FIX_PLAN

---

## 1. Lịch sử làm việc của Hermes (tóm tắt)

Hermes đã tạo ra 9 file tài liệu theo thứ tự:

| # | File | Ngày | Nội dung |
|---|---|---|---|
| 1 | `AI_ARCHITECTURE_REVIEW.md` | 2026-06-27 | Phân tích kiến trúc, thiết kế AI module, TODO 3 phase |
| 2 | `AI_IMPLEMENTATION_PLAN.md` | 2026-06-27 | Checklist chi tiết, danh sách file tạo/sửa, risk assessment |
| 3 | `PHASE1_COMPLETION_REPORT.md` | 2026-06-27 | Phase 1 xong: build pass, 30 file mới, AI module lazy 28 kB |
| 4 | `AI_CONNECTION_DEBUG_REPORT.md` | 2026-06-27 | Fix 3 bug: model sai, parser `response` vs `message.content`, `req.on('close')` bug |
| 5 | `AI_PROVIDER_MIGRATION_REPORT.md` | 2026-06-28 | Thêm LocalProvider + CloudProvider + AiSettingsService + Settings UI |
| 6 | `AI_CONNECTION_FIX_REPORT.md` | 2026-06-28 | Fix LocalProvider.testConnection() dùng 2-step ping, endpoint readonly trong UI |
| 7 | `AI_FETCH_ERROR_ROOTCAUSE.md` | 2026-06-28 | Chrome headless test: "Failed to fetch" chỉ xảy ra với `file://` origin |
| 8 | `AI_CLOUD_PROXY_IMPLEMENTATION.md` | 2026-06-28 | Tạo `/api/chat` proxy cho Cloud (refactor CloudProvider gọi qua proxy) |
| 9 | `OLLAMA_CLOUD_AUTH_AUDIT.md` | 2026-06-28 | Xác minh API key được forward đúng, test với REAL key → 200 OK |
| 10 | `REQUEST_FLOW_AUDIT.md` | 2026-06-28 | CDP Chrome DevTools capture: xác nhận Browser chỉ gọi `/api/chat`, không gọi thẳng ollama.com |

---

## 2. Kiến trúc hiện tại

```
┌─────────────────────────────────────────────────────────────────────┐
│                     BROWSER (Angular 19 SSR)                        │
│                                                                     │
│  AiSettingsComponent                                                │
│    └── testConnection()                                             │
│          ├── factory.configureLocal('http://localhost:11434')       │
│          ├── factory.configureCloud(apiKey, model, CLOUD_ENDPOINT)  │
│          │       ← ⚠️ CLOUD_ENDPOINT = 'https://ollama.com/api/...  │
│          └── provider.testConnection()                              │
│                                                                     │
│  AiAssistantComponent                                               │
│    └── AiService.ask(question)                                      │
│          └── this.provider ← computed từ ProviderFactory            │
│                                                                     │
│  ProviderFactory                                                     │
│    ├── LocalProvider  → fetch('http://localhost:11434/api/generate')│
│    └── CloudProvider  → fetch(this.proxyUrl)                        │
│                          ← proxyUrl mặc định = '/api/chat' ✅       │
│                          ← nhưng bị ghi đè = CLOUD_ENDPOINT ⚠️     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ same-origin fetch /api/chat
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│          EXPRESS SSR Server (src/server.ts)                         │
│                                                                     │
│  POST /api/chat  ← NEW proxy (local + cloud, with Bearer auth)      │
│  POST /api/ai/chat ← OLD proxy (local only, legacy)                 │
│                                                                     │
│  /api/chat:                                                         │
│    provider=local  → http://127.0.0.1:11434/api/generate            │
│    provider=cloud  → https://ollama.com/api/generate                │
│                       Authorization: Bearer <apiKey>                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ server-to-server (no CORS)
                               ▼
                    ┌────────────────────────┐
                    │  Ollama Local :11434   │  ← qwen2.5-coder:7b
                    │  Ollama Cloud          │  ← gpt-oss:120b-cloud
                    └────────────────────────┘
```

---

## 3. Files liên quan trực tiếp đến bug

| File | Vai trò | Trạng thái |
|---|---|---|
| `src/app/ai/components/ai-settings/ai-settings.component.ts` | Gọi `testConnection()` — **nơi xảy ra bug chính** | 🔴 CÓ BUG |
| `src/app/ai/providers/cloud.provider.ts` | CloudProvider: gọi `this.proxyUrl` | ✅ Code đúng (bị nạp sai dữ liệu) |
| `src/app/ai/providers/local.provider.ts` | LocalProvider: gọi trực tiếp Ollama local | ✅ Code đúng |
| `src/app/ai/providers/provider-factory.service.ts` | Factory: `configureCloud(apiKey, model, proxyUrl?)` | ✅ Code đúng |
| `src/app/ai/models/ai-chat.model.ts` | `DEFAULT_AI_SETTINGS.model = 'nemotron-3-super:cloud'` | 🟡 SAI cho Local |
| `src/environments/environment.ts` | `model: 'nemotron-3-super:cloud'`, `ollamaProxy: '/api/ai/chat'` | 🟡 SAI cho Local |
| `src/server.ts` | Hai endpoint `/api/chat` + `/api/ai/chat` cùng tồn tại | 🟡 DƯ THỪA |
| `src/app/ai/services/ollama.service.ts` | Trỏ đến `/api/ai/chat` (old endpoint) | 🟡 DEAD CODE |

---

## 4. Bugs được xác nhận — Theo độ ưu tiên

---

### 🔴 BUG #1 — CRITICAL: Cloud Test Connection gọi Ollama trực tiếp (CORS)

**File:** `src/app/ai/components/ai-settings/ai-settings.component.ts`

**Dòng bị lỗi (khoảng dòng 48):**
```typescript
const CLOUD_ENDPOINT = 'https://ollama.com/api/generate';
//                      ↑ Đây là URL của Ollama Cloud upstream — KHÔNG PHẢI proxy URL
...
this.factory.configureCloud(s.cloudApiKey, s.model, CLOUD_ENDPOINT);
//                                                    ↑ Truyền upstream URL làm proxyUrl → BUG
```

**Chain lỗi:**
```
AiSettingsComponent.testConnection()
  → factory.configureCloud(key, model, 'https://ollama.com/api/generate')
    → cloud.configure({ proxyUrl: 'https://ollama.com/api/generate' })
      → this.proxyUrl = 'https://ollama.com/api/generate'  ← ghi đè default '/api/chat'
        → cloud.testConnection()
          → fetch('https://ollama.com/api/generate', ...)   ← browser gọi thẳng Cloud
            → No CORS header từ ollama.com
              → TypeError: Failed to fetch  ← lỗi user thấy
```

**Tại sao Hermes "PASS" mà user vẫn fail?**
Hermes test bằng `curl` (server-side) và Chrome headless với HTML riêng (không chạy Angular code thật). Trong Chrome headless test, Hermes tự tạo HTML gọi `/api/chat` trực tiếp — không đi qua `AiSettingsComponent.testConnection()`. Nên bỏ qua bug này.

**Fix:**
```typescript
// TRƯỚC (sai):
this.factory.configureCloud(s.cloudApiKey, s.model, CLOUD_ENDPOINT);

// SAU (đúng):
this.factory.configureCloud(s.cloudApiKey, s.model);
// hoặc rõ ràng hơn:
this.factory.configureCloud(s.cloudApiKey, s.model, '/api/chat');
```

**Confidence:** 100% — Đọc code source, trace đầy đủ, không có nghi ngờ.

---

### 🔴 BUG #2 — CRITICAL: Default model `nemotron-3-super:cloud` phá Local chat

**Files:**
- `src/app/ai/models/ai-chat.model.ts` — `DEFAULT_AI_SETTINGS.model = 'nemotron-3-super:cloud'`
- `src/environments/environment.ts` — `model: 'nemotron-3-super:cloud'`

**Vấn đề:**
```typescript
export const DEFAULT_AI_SETTINGS: AiSettings = {
  model: 'nemotron-3-super:cloud',  // ← tên Cloud model, không pull được ở local
  ...
};
```

Khi user dùng Local provider với model mặc định `nemotron-3-super:cloud`:
- `LocalProvider.chat()` gọi `/api/generate` với `model: 'nemotron-3-super:cloud'`
- Ollama local không có model này → `HTTP 404: model not found`

**Lưu ý:** `LocalProvider.testConnection()` tự auto-detect model từ `/api/tags` nên **Test Connection có thể PASS** nhưng **chat thực tế sẽ FAIL**.

**Models có sẵn local:** `qwen2.5-coder:7b`, `qwen3:0.6b`, `nemotron-3-super` (không có `:cloud`)

**Fix:**
```typescript
// TRƯỚC:
model: 'nemotron-3-super:cloud',

// SAU (đặt model local mặc định an toàn):
model: 'qwen3:0.6b',
```

**Confidence:** 100%

---

### 🟡 BUG #3 — MODERATE: `ai-settings.component.ts` — `configureCloud` bị gọi ngay cả khi test Local

**File:** `src/app/ai/components/ai-settings/ai-settings.component.ts`

```typescript
async testConnection(): Promise<void> {
  const s = this.settings();
  this.factory.configureLocal(LOCAL_ENDPOINT);
  this.factory.configureCloud(s.cloudApiKey, s.model, CLOUD_ENDPOINT); // ← luôn gọi
  const provider = s.provider === 'cloud' ? this.cloud : this.local;
```

Ngay cả khi user đang dùng Local provider, `configureCloud` vẫn được gọi với `CLOUD_ENDPOINT` → `CloudProvider.proxyUrl` bị ghi thành `'https://ollama.com/api/generate'`. Nếu user sau đó switch sang Cloud và chat (không qua testConnection lần nữa), CloudProvider vẫn dùng proxyUrl sai.

**Fix:** Chỉ configure provider cần thiết, hoặc luôn dùng `/api/chat`.

**Confidence:** 100%

---

### 🟡 BUG #4 — MODERATE: Hai proxy endpoint trùng lặp trong server.ts

**File:** `src/server.ts`

- `POST /api/chat` — mới, xử lý cả Local và Cloud, có Bearer auth ✅
- `POST /api/ai/chat` — cũ, chỉ xử lý Local, không có auth

**Tình trạng:**
- `CloudProvider` gọi `/api/chat` ✅
- `LocalProvider` gọi trực tiếp `http://localhost:11434` (không qua proxy)
- `OllamaService` (dead code) gọi `/api/ai/chat` (old)

Không gây lỗi ngay nhưng:
1. Tốn bộ nhớ / code thừa
2. Gây nhầm lẫn khi debug
3. Nếu ai đó vô tình dùng `/api/ai/chat` cho Cloud sẽ thất bại silently (không có Bearer auth)

**Confidence:** 100%

---

### 🟡 BUG #5 — LOW: OllamaService là dead code nhưng vẫn tồn tại

**File:** `src/app/ai/services/ollama.service.ts`

`OllamaService` trỏ đến `environment.ai.ollamaProxy = '/api/ai/chat'` (old endpoint). Nhưng `ai.service.ts` hiện đã dùng `ProviderFactory` thay thế, `OllamaService` không còn được inject ở đâu.

**Không gây lỗi runtime** nhưng:
- Thêm vào bundle không cần thiết (nếu không tree-shaken)
- Gây nhầm lẫn khi đọc code

**Confidence:** 95%

---

### 🟢 KHÔNG PHẢI BUG: Local Provider trực tiếp đến Ollama

Hermes đã xác nhận và mình đọc code đồng ý:
- `LocalProvider.testConnection()` gọi `http://localhost:11434/api/tags` → `/api/generate`
- Khi app chạy qua HTTP server (ng serve / node server.mjs), Ollama CORS OK
- Nếu user thấy "Failed to fetch" với Local, nguyên nhân môi trường:
  1. Ollama không chạy
  2. App mở qua `file://` protocol (null origin → CORS block)
  3. Browser extension chặn
  4. Firewall chặn port 11434

---

## 5. Root cause tổng hợp

| Lỗi | Root cause | File | Dòng |
|---|---|---|---|
| Cloud "Failed to fetch" | `CLOUD_ENDPOINT` truyền làm `proxyUrl` vào CloudProvider | `ai-settings.component.ts` | ~48 |
| Local chat fail (model not found) | Default model là `nemotron-3-super:cloud` | `ai-chat.model.ts`, `environment.ts` | model field |
| configureCloud luôn gọi khi Local | Logic không kiểm tra provider trước khi configure | `ai-settings.component.ts` | ~46-48 |
| Dead proxy `/api/ai/chat` | Refactor không dọn code cũ | `server.ts` | ~130+ |
| OllamaService dead code | Migration sang ProviderFactory không xóa | `ollama.service.ts` | toàn file |

---

## 6. Tại sao Hermes báo PASS nhưng vẫn còn bug?

Hermes test bằng:
1. `curl` → gọi trực tiếp Express server, KHÔNG đi qua Angular component
2. Chrome headless với HTML test riêng (`test-proxy.html`, `audit-final.html`) → cũng không chạy Angular code
3. Verify `GET /ai/settings/` → HTTP 200 → chỉ test SSR render, không test interactive logic

→ **Không có test nào thực sự nhấn nút "Test Connection" trong Angular app và quan sát console lỗi browser.**

Hermes đã làm đúng về backend. Bug nằm ở **Angular component layer** (cách `testConnection()` gọi `factory.configureCloud()`), không phải ở server.

---

## 7. Confidence level

| Bug | Confidence |
|---|---|
| BUG #1: Cloud proxyUrl sai trong testConnection | **100%** — trace code rõ ràng |
| BUG #2: Default model 'nemotron-3-super:cloud' phá Local chat | **100%** — đọc models list + code |
| BUG #3: configureCloud gọi ngay cả khi Local | **100%** — đọc code |
| BUG #4: Duplicate proxy endpoints | **100%** — đọc server.ts |
| BUG #5: OllamaService dead code | **95%** — cần grep toàn project |

---

## 8. Files không cần sửa

- `src/app/ai/providers/cloud.provider.ts` — Code đúng, chỉ bị nạp sai `proxyUrl` từ bên ngoài
- `src/app/ai/providers/local.provider.ts` — Code đúng
- `src/app/ai/providers/provider-factory.service.ts` — Code đúng
- `src/server.ts` route `/api/chat` — Logic đúng (chỉ cần xóa `/api/ai/chat` cũ)
- `src/app/ai/services/ai.service.ts` — Code đúng (dùng ProviderFactory đúng cách)

---

## 9. Bước tiếp theo

Phase 2 — tạo FIX_PLAN.md với exact code changes.
Phase 3 — implement fixes.
Phase 4 — verify.
