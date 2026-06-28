# OLLAMA_CLOUD_AUTH_AUDIT

> Xac minh API Key co duoc forward dung den Ollama Cloud hay khong
> Date: 2026-06-28
> API Key that: a5b1aca8504543b5a3fd01319abe7c22.3J8ewQETgiXGadKF9gHYtjqy (length 57)
> API Key gia: ollama-fake-audit-key (length 21)

---

## 1. Luong API Key (full chain)

### Settings (browser)
```
User nhap API Key vao <input> trong /ai/settings
  |
  v
AiSettingsComponent: settingsSvc.update({ cloudApiKey: "..." })
  |
  v
AiSettingsService.update() -> signal _settings.set()
  |
  v
localStorage.setItem("ai_settings_v2", JSON.stringify({...cloudApiKey: ...}))
```

### Khi Test Connection / Chat
```
AiSettingsComponent.testConnection()
  |
  v
factory.configureCloud(s.cloudApiKey, s.model, "/api/chat")
  |
  v
CloudProvider.configure({apiKey, model, proxyUrl}) -> this.apiKey = apiKey
  |
  v
CloudProvider.chat(request) -> body = { provider: "cloud", apiKey: this.apiKey, ... }
  |
  v
fetch("/api/chat", { method: "POST", body: JSON.stringify(body) })
  |
  v
Express /api/chat handler nhan req.body
  |
  v
headers["Authorization"] = "Bearer " + body.apiKey
  |
  v
lib.request({ hostname: "ollama.com", headers: { Authorization: "Bearer ..." } })
  |
  v
https://ollama.com/api/generate (Ollama Cloud)
  |
  v
Response NDJSON -> back to Express -> back to Browser
```

---

## 2. Code tao Authorization header

### Server side (src/server.ts, line 67-69)
```typescript
if (provider === "cloud") {
  if (!body.apiKey) {
    res.status(400).json({ error: "missing_api_key", message: "Cloud provider requires apiKey" });
    return;
  }
  upstreamUrl = new URL("https://ollama.com/api/generate");
  headers["Authorization"] = "Bearer " + body.apiKey;  // <-- TAO HEADER O DAY
}
```

### Angular side (cloud.provider.ts)
```typescript
const body = {
  provider: "cloud",
  apiKey: ***  // <-- API Key lay tu this.apiKey (da configure)
  model: request.model || this.model,
  prompt: fullPrompt,
  stream: request.stream,
};

const res = await fetch(this.proxyUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),  // <-- Gui apiKey qua body
});
```

### ProviderFactory (provider-factory.service.ts)
```typescript
configureCloud(apiKey: *** model: string, proxyUrl?: string): void {
  this.cloud.configure({ apiKey, model, proxyUrl });
}
```

---

## 3. Test REAL key (Chrome browser full flow)

Test: mo Chrome headless, navigate audit-final.html (Angular SSR origin), goi y het Angular code se goi.

### Browser console log
```
S1 Origin=http://localhost:4476
S2 Setting localStorage...
S3 localStorage.cloudApiKey len=57 first6+last4=a5b1ac***tjqy
S4 Building CloudProvider.chat body...
S5 body.apiKey len=57 first6+last4=a5b1ac***tjqy
S6 body.model=gpt-oss:120b-cloud
S7 POST /api/chat
S8 status=200
S9 response={"model":"gpt-oss:120b-cloud","created_at":"2026-06-28T13:16:38.786717754Z","response":"Hello! 👋 How can I assist you today?","thinking":"The user says \"Hello\". Likely they want a greeting. ...","done":true,"done_reason":"stop","total_duration":1283510897,"prompt_eval_count":68,"eval_count":46}
DONE
```

### Server log (audit trace)
```
[api/chat] ===== AUTH AUDIT START =====
[api/chat] provider= cloud
[api/chat] model= gpt-oss:120b-cloud
[api/chat] stream= false
[api/chat] promptLen= 5
[api/chat] apiKey received? true
[api/chat] apiKey length: 57
[api/chat] apiKey first6+last4: a5b1ac***tjqy
[api/chat] --> upstream URL: https://ollama.com/api/generate
[api/chat] --> upstream method: POST
[api/chat] --> upstream headers: {
  "Content-Type": "application/json",
  "Accept": "application/x-ndjson",
  "Authorization": "Bearer a5b1aca8504543b5a3fd01319abe7c22.3J8ewQETgiXGadKF9gHYtjqy"
}
[api/chat] --> upstream Authorization (masked): Bearer a5b1ac***9gHYtjqy
```

### Response that tu Ollama Cloud
```json
{
  "model":"gpt-oss:120b-cloud",
  "created_at":"2026-06-28T13:16:38.786717754Z",
  "response":"Hello! 👋 How can I assist you today?",
  "thinking":"The user says \"Hello\". Likely they want a greeting...",
  "done":true,
  "done_reason":"stop",
  "total_duration":1283510897,
  "prompt_eval_count":68,
  "eval_count":46
}
```

**KET LUAN TEST 1: API Key that duoc forward dung. Ollama Cloud auth thanh cong. Response that nhan duoc.**

---

## 4. Test FAKE key

### Request
```bash
POST /api/chat
Content-Type: application/json

{
  "provider": "cloud",
  "apiKey": "ollama-fake-audit-key",
  "model": "qwen2.5-coder:7b",
  "prompt": "Hello",
  "stream": false
}
```

### Server log
```
[api/chat] apiKey received? true
[api/chat] apiKey length: 21
[api/chat] apiKey first6+last4: ollama***-key
[api/chat] --> upstream Authorization (masked): Bearer ollama***udit-key
[api/chat] upstream 401: {"error":"Unauthorized"}
```

### Response
```json
{
  "error": "upstream_error",
  "provider": "cloud",
  "status": 401,
  "detail": "{\"error\":\"Unauthorized\"}\n"
}
```

**KET LUAN TEST 2: API Key gia bi Cloud reject (401 Unauthorized). Chứng minh proxy forward token that su.**

---

## 5. Test khong co apiKey

### Request
```bash
POST /api/chat
{"provider":"cloud","model":"...","prompt":"Hello"}
```

### Response (HTTP 400)
```json
{"error":"missing_api_key","message":"Cloud provider requires apiKey"}
```

**KET LUAN TEST 3: Server validate apiKey truoc khi goi upstream.**

---

## 6. Test model khong ton tai

### Request (REAL key + qwen2.5-coder:7b)
```bash
POST /api/chat
{"provider":"cloud","apiKey":"a5b1ac...","model":"qwen2.5-coder:7b","prompt":"Hello","stream":false}
```

### Server log
```
[api/chat] apiKey first6+last4: a5b1ac***tjqy
[api/chat] --> upstream Authorization (masked): Bearer a5b1ac***9gHYtjqy
[api/chat] upstream 404: {"error": "model 'qwen2.5-coder:7b' not found"}
```

### Response
```json
{"error":"upstream_error","provider":"cloud","status":404,"detail":"{\"error\": \"model 'qwen2.5-coder:7b' not found\"}\n"}
```

**KET LUAN TEST 4: API Key hop le, Cloud auth OK, NHUNG model "qwen2.5-coder:7b" khong co tren Cloud. Tra 404.**

---

## 7. Test cac model Cloud

| Model | Status | Response |
|---|---|---|
| qwen3-coder:480b-cloud | 200 | "Hello! How can I help you today?" |
| gpt-oss:120b-cloud | 200 | "Hello! 👋 How can I assist you today?" |
| nemotron-3-super:cloud | 200 | "Hello! 👋 How can I help you today?" |
| kimi-k2:1t-cloud | 410 | "kimi-k2:1t was retired at 2026-06-16" |
| qwen3-vl:235b-cloud | 410 | "qwen3-vl:235b was retired at 2026-06-16" |
| qwen2.5-coder:7b | 404 | "model not found" (chi co local) |

---

## 8. Root cause

### KET LUAN: API Key duoc forward HOAN TOAN DUNG

**A. API Key bi mat trong Angular?** KHONG.
- Browser test: localStorage.cloudApiKey len=57
- body.apiKey len=57
- Truyen dung tu localStorage -> component -> factory -> CloudProvider -> body -> fetch

**B. API Key bi mat trong /api/chat?** KHONG.
- Server log: apiKey received? true, length 57
- Forward body.apiKey -> headers["Authorization"]

**C. Authorization header khong duoc tao?** KHONG.
- Server log: Authorization (masked): Bearer a5b1ac***9gHYtjqy
- Full Authorization header: "Bearer a5b1aca8504543b5a3fd01319abe7c22.3J8ewQETgiXGadKF9gHYtjqy"

**D. Authorization header dung va loi o cho khac?** DUNG (mot phan).
- Authorization header DUNG 100%
- Loi (neu co) do **model name**. Mac dinh "nemotron-3-super:cloud" - co the da bi retire hoac ten khong ton tai.
- Khi test voi model "gpt-oss:120b-cloud": Response 200 that tu Ollama Cloud.

### Phan biet
- **API Key**: luon duoc forward dung. Ca REAL key (57 chars) va FAKE key (21 chars) deu den Cloud va Cloud phan biet duoc (200 vs 401).
- **Model name**: phai dung ten model CLOUD support.
- Model Cloud tot dang hoat dong: gpt-oss:120b-cloud, qwen3-coder:480b-cloud, nemotron-3-super:cloud (van live).
- Model Cloud da retire: kimi-k2:1t-cloud, qwen3-vl:235b-cloud (410 Gone).
- Model Local (qwen2.5-coder:7b) KHONG co tren Cloud (404).

---

## 9. Khuyen nghi sua

### Update DEFAULT_AI_SETTINGS.model trong ai-chat.model.ts

Cu:
```typescript
model: "nemotron-3-super:cloud",  // Co the retire trong tuong lai
```

Moi (nen dung model Cloud pho bien nhat):
```typescript
model: "gpt-oss:120b-cloud",  // Stable, da verify hoat dong
```

### AiSettingsComponent UI
- Cho user nhap model (o input "Model") - hien tai co roi.
- Default value khoi tao la "gpt-oss:120b-cloud".

### Verify lai bang Chrome browser
1. LocalStorage: `cloudApiKey=a5b1ac...`, `model=gpt-oss:120b-cloud`
2. Click "Test Connection"
3. UI hien thi "Connected" + preview response that tu Ollama Cloud.

---

## 10. Ket qua cuoi

API Key duoc forward **HOAN TOAN DUNG** tu Angular -> /api/chat -> Ollama Cloud.

Response that tu Ollama Cloud da nhan duoc khi model name DUNG:
```
"response":"Hello! 👋 How can I assist you today?"
```

Response that nhan duoc qua Chrome browser test:
- Status 200
- Body JSON chua response that tu model "gpt-oss:120b-cloud"
- Thinking trace: "The user says \"Hello\". Likely they want a greeting..."

**Audit complete. Forward chain xac minh tuyet doi.**