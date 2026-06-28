# REQUEST_FLOW_AUDIT

> Xac minh URL thuc te ma Cloud Provider va Local Provider dang goi
> Date: 2026-06-28
> Phuong phap: Chrome DevTools Protocol (CDP) capture Network tab
> Browser: Chrome headless 149.0.7827.199

---

## 1. Cloud Provider - URL thuc te

### Test scenario
- User mo /ai/settings/
- Cloud API Key da luu trong localStorage
- Click "Test Connection"

### CDP Network capture (from Chrome DevTools Protocol)
```
[NET] REQUEST: POST http://localhost:4488/api/chat
  Referer: http://localhost:4488/ai/settings
  Content-Type: application/json
  (KHONG co Authorization header - browser khong co key truc tiep)
[NET] RESPONSE: 200 http://localhost:4488/api/chat

=== JS RESULT ===
status=200 body={"model":"gpt-oss:120b-cloud",...,"response":"Hello! 👋 How can I assist you today?",...}
```

### Server log (audit trace)
```
[api/chat] apiKey received? true
[api/chat] apiKey length: 57
[api/chat] apiKey first6+last4: a5b1ac***tjqy
[api/chat] --> upstream URL: https://ollama.com/api/generate
[api/chat] --> upstream method: POST
[api/chat] --> upstream Authorization (masked): Bearer a5b1ac***9gHYtjqy
```

### KET LUAN CLOUD

**URL Browser goi**: `http://localhost:4488/api/chat` (proxy same-origin)
**URL Server goi**: `https://ollama.com/api/generate` (upstream)
**Authorization header chi co o upstream**, KHONG co o request browser (browser khong co API key truc tiep, chi forward qua body).

**Browser KHONG bao gio goi truc tiep https://ollama.com/api/generate.**
Toan bo luong di qua /api/chat proxy.

### File lien quan Cloud
| File | Vai tro |
|---|---|
| `src/app/ai/providers/cloud.provider.ts` | fetch(this.proxyUrl) where proxyUrl="/api/chat" |
| `src/server.ts` (line 67-69) | `headers["Authorization"] = "Bearer " + body.apiKey` |
| `src/app/ai/providers/provider-factory.service.ts` | `configureCloud(apiKey, model, proxyUrl?)` |
| `src/app/ai/components/ai-settings/ai-settings.component.ts` | `factory.configureCloud(s.cloudApiKey, s.model, "/api/chat")` |

### Class/Method tao request
- File: `src/app/ai/providers/cloud.provider.ts`
- Class: `CloudProvider`
- Method: `chat()` va `testConnection()`
- Doan code: `const res = await fetch(this.proxyUrl, { method: "POST", ... })`

---

## 2. Local Provider - URL thuc te

### Test scenario
- User o /ai/settings, chon Provider = Local
- Click "Test Connection"

### CDP Network capture
```
[NET] REQUEST: GET http://localhost:11434/api/tags
  Referer: http://localhost:4494/
[NET] RESPONSE: 200 http://localhost:11434/api/tags

[NET] REQUEST: POST http://localhost:11434/api/generate
  Content-Type: application/json
  Body: {model: "qwen2.5-coder:7b", prompt: "Hi", stream: false}
[NET] RESPONSE: 200 http://localhost:11434/api/generate

[NET] REQUEST: POST http://localhost:4494/api/chat
  Content-Type: application/json
  Body: {provider: "local", model: "qwen2.5-coder:7b", prompt: "Hi", stream: false}
[NET] RESPONSE: 200 http://localhost:4494/api/chat

=== JS RESULT ===
DIRECT_GET_TAGS: status=200
DIRECT_POST_GENERATE: status=200 len=506
PROXY_CHAT: status=200 len=506
```

### KET LUAN LOCAL

**URL Browser goi truc tiep**: `http://localhost:11434/api/generate`
**URL Browser goi qua proxy**: `/api/chat` (cung OK)
**Ca hai deu 200 OK.**

### Class/Method tao request
- File: `src/app/ai/providers/local.provider.ts`
- Class: `LocalProvider`
- Method: `chat()` va `testConnection()`
- Doan code: `const res = await fetch(url, { method: "POST", ... })` where `url = baseUrl + "/api/generate"`

### 403 Forbidden tu user?
CDP test that su 200 OK. User co the gap 403 do:
- Antivirus/Firewall chan port 11434
- Browser extension (ad blocker) chan localhost:11434
- Ollama service down luc test
- Browser cache proxy authentication (hiem)

---

## 3. Root cause

### Cloud Provider
**KHONG co bug**. Code dang dung:
- `CloudProvider.chat()` -> `fetch(this.proxyUrl)` where proxyUrl="/api/chat"
- Server `/api/chat` forward sang Cloud voi Authorization header
- CDP capture xac nhan Browser chi goi `/api/chat`, server goi `https://ollama.com/api/generate`

### Local Provider
**KHONG co bug**. Code dang dung:
- `LocalProvider.chat()` -> `fetch(url)` where url=`http://localhost:11434/api/generate`
- CDP capture xac nhan Browser goi truc tiep localhost:11434
- Response 200 OK that su

### TAI SAO USER NHO THAY "https://ollama.com/api/generate" trong Network tab?
Co the do:
1. Network tab cua Chrome hien thi response URL chu khong phai request URL?
   - KHONG: Network tab hien thi REQUEST URL.
2. User nhin nham giua upstream URL (server) va request URL (browser)?
   - Co the. Upstream URL la "https://ollama.com/api/generate" nhung chi xuat hien trong SERVER log, KHONG xuat hien trong BROWSER Network tab.
3. Browser extension cua user chan hien thi request?
4. User test truoc khi code refactor (khi CloudProvider con goi truc tiep ollama.com)?
   - **Co the**: Truoc khi co proxy, CloudProvider goi `https://ollama.com/api/generate` truc tiep. Browser Network tab se hien thi URL do. Sau khi refactor thanh `/api/chat`, Network tab se chi hien thi `/api/chat`.
   - CDP test hien tai xac nhan Browser chi goi `/api/chat`.

---

## 4. File da sua

Khong co file nao can sua. Code hien tai DUNG:
- Cloud Provider goi qua proxy (dung thiet ke)
- Local Provider goi truc tiep localhost (dung thiet ke)
- Server forward Cloud request voi Bearer token (dung)

---

## 5. Ket qua test sau khi xac minh

### Cloud Provider (REAL key)
```
Browser POST http://localhost:4488/api/chat
  -> RESPONSE 200
  -> body: {"response": "Hello! 👋 How can I assist you today?", ...}
Server forward to https://ollama.com/api/generate
  -> Authorization: Bearer a5b1ac***9gHYtjqy
  -> RESPONSE 200 from Cloud
```

### Cloud Provider (FAKE key)
```
Browser POST http://localhost:4488/api/chat
  -> RESPONSE 401
  -> body: {"error":"upstream_error","provider":"cloud","status":401,"detail":"Unauthorized"}
```

### Local Provider (direct)
```
Browser GET http://localhost:11434/api/tags
  -> RESPONSE 200
Browser POST http://localhost:11434/api/generate
  -> RESPONSE 200, len=506
```

### Local Provider (via proxy)
```
Browser POST http://localhost:4494/api/chat {provider: "local", model: "qwen2.5-coder:7b", prompt: "Hi"}
  -> RESPONSE 200, len=506
```

---

## 6. KET LUAN CUOI

**Khong co bug.** Cloud Provider va Local Provider hoat dong CHINH XAC:
- Cloud Provider: Browser -> /api/chat -> Server -> Ollama Cloud (voi Bearer token)
- Local Provider: Browser -> localhost:11434 (CORS OK tu Ollama 0.30+)

Neu user van thay URL `https://ollama.com/api/generate` trong Network tab:
- Co the do cache trinh duyet (thu hard reload Ctrl+Shift+R)
- Co the do extension browser chan proxy path
- Co the do user test phien ban cu (truoc refactor)

CDP capture hien tai xac nhan Browser KHONG goi truc tiep ollama.com.