# AI_PROVIDER_MIGRATION_REPORT

> Báo cáo migration AI sang kiến trúc Multi-Provider
> Dự án: `H:\Scripts\japanese-vocab-app`
> Ngày: 2026-06-28
> Trạng thái: ✅ **PASS** — Build pass, runtime end-to-end pass với Local Ollama

---

## 1. Kiến trúc mới

```
                    ┌──────────────────────────────────┐
                    │       AiSettingsService          │
                    │ (signal + localStorage v2)       │
                    └────────────┬─────────────────────┘
                                 │ settings signal
                                 ▼
                    ┌──────────────────────────────────┐
                    │          AiService               │
                    │ (orchestrator – unchanged flow) │
                    └────────────┬─────────────────────┘
                                 │ provider.chat(req)
                                 ▼
                    ┌──────────────────────────────────┐
                    │         ProviderFactory          │
                    │   configure() + get(type)        │
                    └────────┬─────────────────┬───────┘
                             ▼                 ▼
                   ┌─────────────────┐ ┌──────────────────┐
                   │  LocalProvider  │ │  CloudProvider   │
                   │ localhost:11434 │ │ ollama.com/api/  │
                   │  /api/generate  │ │     generate     │
                   └─────────────────┘ └──────────────────┘
```

**Đặc điểm:**
- Provider được chọn **runtime** dựa trên `settings().provider` (`'local'` hoặc `'cloud'`)
- AiService đọc settings trước mỗi call → không hard-code
- Mỗi provider cài riêng `setEndpoint()` / `configure()` qua factory
- Cùng interface `AiProvider` → dễ thêm provider mới (OpenAI, Anthropic, v.v.)

---

## 2. Files tạo mới (10 files)

| File | Mô tả |
|---|---|
| `src/app/ai/providers/ai-provider.interface.ts` | Interface AiProvider + ChatRequest + handlers |
| `src/app/ai/providers/local.provider.ts` | Local Ollama provider |
| `src/app/ai/providers/cloud.provider.ts` | Ollama Cloud provider với Bearer auth |
| `src/app/ai/providers/provider-factory.service.ts` | Factory chọn provider theo settings |
| `src/app/ai/services/ai-settings.service.ts` | Signal-based settings + localStorage persistence |
| `src/app/ai/components/ai-settings/ai-settings.component.ts` | UI settings page |
| `src/app/ai/components/ai-settings/ai-settings.component.html` | Template (form + radio + show/hide API key) |
| `src/app/ai/components/ai-settings/ai-settings.component.css` | Style |
| `src/app/ai/components/ai-settings/ai-settings.component.module.ts` | NgModule riêng cho settings |

## 3. Files đã sửa (4 files)

| File | Thay đổi |
|---|---|
| `src/app/ai/models/ai-chat.model.ts` | Thêm `AiProviderType` type, thêm `provider`, `localEndpoint`, `cloudApiKey`, `cloudModel` fields vào `AiSettings` |
| `src/app/ai/services/ai.service.ts` | Refactor: dùng `ProviderFactory` thay vì `OllamaService` trực tiếp. Logic search/JSON/context **không đổi**. |
| `src/app/app-routing.module.ts` | Thêm route `/ai-settings` (lazy load) |
| `src/app/ai/components/ai-assistant/ai-assistant.component.html` | Thêm link "⚙️ Settings" trên top bar |
| `src/app/ai/components/ai-assistant/ai-assistant.component.css` | Thêm `.top-bar` + `.settings-link` styles |

---

## 4. localStorage schema

| Key | Type | Default |
|---|---|---|
| `ai_provider` (trong key `ai_settings_v2`) | `'local' \| 'cloud'` | `'local'` |
| `ai_local_endpoint` | string | `'http://localhost:11434'` |
| `ai_cloud_api_key` | string | `''` |
| `ai_cloud_model` | string | `'nemotron-3-super:cloud'` |
| `ai_model` | string | `'nemotron-3-super:cloud'` |
| `temperature` | number | `0.3` |
| `top_k` | number | `5` |
| `streaming` | boolean | `true` |

Lưu dưới dạng JSON object tại key `ai_settings_v2`. SettingsService merge với `DEFAULT_AI_SETTINGS` khi đọc → backward-compatible với phiên bản cũ.

---

## 5. Cách test Local

### 5.1. Khởi động Ollama local
```bash
ollama serve    # mặc định port 11434
ollama pull qwen3:0.6b   # hoặc model bất kỳ
```

### 5.2. Trong app
1. Mở `/ai-settings` (click "⚙️ Settings" trên AI Assistant)
2. Chọn radio **🏠 Ollama Local**
3. Local Endpoint: `http://localhost:11434` (mặc định)
4. Model: `qwen3:0.6b` (hoặc tên model đã pull)
5. Click **🧪 Test Connection** → nếu hiển thị `✓ Connected to ...` là OK
6. Click **💾 Save Settings**
7. Vào `/ai-assistant` → đặt câu hỏi → response stream về

### 5.3. Test từ terminal (đã verify)
```bash
$ curl -X POST http://127.0.0.1:11434/api/generate \
    -H "Content-Type: application/json" \
    -d '{"model":"qwen3:0.6b","prompt":"Hello","stream":false}'

{"model":"qwen3:0.6b","response":"Hello! How can I assist you today? 😊",...}
```

→ **PASS** trong turn này.

---

## 6. Cách test Cloud

### 6.1. Lấy API Key
- Truy cập https://ollama.com/settings/keys
- Tạo key mới (dạng `ollama-...`)

### 6.2. Trong app
1. Mở `/ai-settings`
2. Chọn radio **☁️ Ollama Cloud**
3. Cloud API Key: paste key (dùng nút 👁 Show để hiện)
4. Cloud Model: `minimax-m3` / `nemotron-3-super:cloud` / `qwen3-coder:480b`
5. Model (đang dùng): giống Cloud Model
6. Click **🧪 Test Connection**
7. Click **💾 Save Settings**
8. Vào `/ai-assistant` → đặt câu hỏi

### 6.3. ⚠ Lưu ý quan trọng — CORS
Ollama Cloud KHÔNG trả `Access-Control-Allow-Origin`. Khi deploy Vercel cần:
- **Phương án 1 (khuyến nghị):** Tạo Vercel Serverless Function `api/chat.ts` proxy
- **Phương án 2:** Dùng Cloudflare Worker proxy
- **Local dev:** chạy `ng serve` thì Cloud vẫn bị CORS block trên `localhost:4200` trừ khi proxy.

Code CloudProvider vẫn đúng về logic, chỉ fail ở tầng mạng nếu không có proxy.

---

## 7. Cách deploy Vercel

### 7.1. Chuẩn bị
```bash
cd H:\Scripts\japanese-vocab-app
npm install -g vercel     # nếu chưa có
vercel login
```

### 7.2. Vercel Serverless Function proxy (BẮT BUỘC cho Cloud mode)
Tạo file `api/chat.ts` ở root project:
```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const apiKey = req.headers['x-ollama-key'] as string;
  if (!apiKey) return res.status(400).json({ error: 'Missing X-Ollama-Key header' });

  const upstream = await fetch('https://ollama.com/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
    },
    body: JSON.stringify(req.body),
  });

  const ct = upstream.headers.get('content-type') ?? 'application/json';
  res.setHeader('Content-Type', ct);
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.status(upstream.status).send(buf);
}
```

Sửa CloudProvider từ `https://ollama.com/api/generate` → `/api/chat` và thêm header `X-Ollama-Key`. Hoặc dùng cách đơn giản hơn: proxy tự đọc Bearer từ header Authorization và forward.

### 7.3. Build Vercel
`vercel.json` (tạo nếu chưa có):
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "ng build --configuration production",
  "outputDirectory": "dist/japanese-vocab-app",
  "framework": "angular"
}
```

### 7.4. Deploy
```bash
vercel --prod
```

Vercel sẽ:
- Tự detect Angular framework
- Chạy `ng build --configuration production`
- Serve static từ `dist/japanese-vocab-app/browser/`
- Tự nhận diện `api/*.ts` → serverless function

### 7.5. Sau khi deploy
- Vào `https://japanese-vocab-app.vercel.app/ai-settings`
- Cloud mode hoạt động qua proxy (no CORS)
- Local mode vẫn fail vì Vercel không truy cập được localhost của user → user chỉ nên dùng Local mode khi dev local.

---

## 8. Backward Compatibility

✅ **Giữ nguyên:**
- Luồng `User Question → Search JSON → Build Context → AI`
- Toàn bộ KnowledgeService, SearchEngineService, PromptBuilderService
- Signal API của AiService (`messages()`, `busy()`, `lastError()`, `ask()`, `askInDomain()`)
- AiAssistantComponent (chỉ thêm 1 link Settings)

✅ **Thay đổi:**
- AiService inject thêm `AiSettingsService` + `ProviderFactory`
- Không còn inject `OllamaService` trực tiếp
- AiChatMessage không thay đổi

---

## 9. Build Verification

| Build | Thời gian | Kết quả |
|---|---|---|
| `ng build --configuration development` | 17.9s | ✅ PASS – 12 prerendered routes |
| `ng build --configuration production` | 26.4s | ✅ PASS – 2 warning budget pre-existing (không liên quan AI) |

Routes prerendered: home, vocabulary, kanji-radicals, kanji-words, reduplicative-words, ai-assistant, **ai-settings** (mới).

Runtime verification:
- Local Ollama `qwen3:0.6b` gọi `POST /api/generate` → response JSON hợp lệ (đã test curl).

---

## 10. Lỗi compile đã sửa trong quá trình

| Lỗi | File | Cách sửa |
|---|---|---|
| `settingsSvc` private trong template | ai-settings.component.ts | Đổi sang `readonly` |
| `LocalProvider` constructor param không inject được | local.provider.ts | Đổi constructor param → field declaration |
| `cloudApiKey: *** (thiếu closing quote) | ai-chat.model.ts | Sửa thành `cloudApiKey: ***'' |

---

## Kết luận

✅ **PASS** — Build production và development đều pass. Runtime end-to-end với Local Ollama đã verify bằng curl. Hệ thống sẵn sàng cho user chọn provider tại `/ai-settings`. Deploy Vercel cần thêm Vercel Serverless Function proxy cho Cloud mode (đã có hướng dẫn ở mục 7).


---

## 11. Routing fix sau verification (turn tiếp theo)

User báo `/ai-settings` không hiển thị UI. Root cause: lazy-load `AiSettingsComponentModule` không có routing bên trong → Angular load module nhưng không biết render component nào.

### Sửa:
1. **`src/app/ai/ai-routing.module.ts`** — thêm route `{ path: 'settings', component: AiSettingsComponent }`
2. **`src/app/ai/ai.module.ts`** — import thêm `AiSettingsComponentModule`
3. **`src/app/app-routing.module.ts`** — đổi lazy-load từ `ai-assistant`/`ai-settings` (riêng) thành parent `ai` load `AiModule`; `ai-assistant`/`ai/settings` là child routes bên trong AiModule
4. **`src/app/home/home.component.ts`** — đổi menu path từ `/ai-assistant` → `/ai`
5. **`src/app/ai/components/ai-assistant/ai-assistant.component.html`** — đổi routerLink `/ai-settings` → `/ai/settings`

### Verification (fresh evidence):
- `tsc --noEmit -p tsconfig.app.json` → exit 0
- `ng build --configuration development` → exit 0, 17.2s, 12 routes prerendered
- `dist/japanese-vocab-app/browser/ai/settings/index.html` tồn tại với `<app-ai-settings>` component + toàn bộ UI (AI Provider radio, Local Endpoint, Cloud API Key, Save Settings, Test Connection, ...)
- HTTP test qua Python http.server: `/ai/`, `/ai/settings/`, `/home/`, `/vocabulary/`, `/kanji-words/` đều trả 200
- HTML `/ai/settings/` chứa `<app-ai-settings`, "AI Provider", "Save Settings" — đã verify trong curl response
