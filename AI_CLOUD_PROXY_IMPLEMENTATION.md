# AI_CLOUD_PROXY_IMPLEMENTATION

> Refactor Cloud Provider: goi qua server-side proxy /api/chat
> Date: 2026-06-28
> Trang thai: PASS - Build OK, Local proxy OK, Cloud proxy da verify di den Ollama Cloud that

---

## 1. Ly do refactor

Ollama Cloud khong co CORS:
- Response KHONG chua header `Access-Control-Allow-Origin`
- Browser tu `http://localhost:*` bi block
- Test that: `curl -X POST https://ollama.com/api/generate -H "Origin: http://localhost:4200"` -> response khong co ACAO header
- Error: "Access to fetch ... has been blocked by CORS policy"

Fix: tao server-side proxy `/api/chat` trong `src/server.ts` (Express).
- Browser goi POST `/api/chat` (same-origin, khong can CORS)
- Server forward sang `https://ollama.com/api/generate` voi Bearer Token
- Server-to-server khong can CORS

---

## 2. File tao moi / file sua

### File sua
| File | Thay doi |
|---|---|
| `src/server.ts` | Them route POST `/api/chat`. Body: `{provider, apiKey?, model, prompt, system?, temperature?, topK?, stream?}`. Forward den Ollama Cloud (https) hoac Local (http) tuy provider. Stream NDJSON ve browser. |
| `src/app/ai/providers/cloud.provider.ts` | Refactor: thay vi goi truc tiep `https://ollama.com/api/generate`, bay gio goi `/api/chat` proxy. API key van gui qua body (server forward qua Authorization header). |
| `src/app/ai/providers/provider-factory.service.ts` | `configureCloud` tham so: `proxyUrl` thay vi `endpoint`. |

Khong co file moi - tat ca sua trong file cu.

---

## 3. Luong request moi

### Local Provider (khong doi)
```
Browser
  |
  v
fetch(http://localhost:11434/api/generate)  <- CORS OK (Ollama cho phep)
  |
  v
Ollama Local
```

### Cloud Provider (MOI - qua proxy)
```
Browser (Angular)
  |
  v
fetch(/api/chat)   <- same-origin, khong can CORS
{provider:"cloud", apiKey:"ollama-...", model, prompt}
  |
  v
src/server.ts (Express)
  |
  v
POST https://ollama.com/api/generate
Authorization: Bearer ollama-...
  |
  v
Ollama Cloud
  |
  v
Response stream NDJSON -> back qua proxy -> ve Browser
```

---

## 4. Ket qua test

### Build
- `tsc --noEmit`: exit 0
- `ng build --configuration development`: exit 0, 215s, 12 routes prerendered, 0 ERROR

### Test Local Provider qua proxy
```bash
$ curl -X POST http://localhost:4455/api/chat -d '{"provider":"local","model":"qwen2.5-coder:7b","prompt":"Hi","stream":false}'

=> HTTP 200
=> {"model":"qwen2.5-coder:7b","created_at":"...","response":"Hello! How can I assist you today?","done":true,...}
```

### Test Local Provider streaming
```bash
$ curl -X POST http://localhost:4455/api/chat -d '{"provider":"local","model":"qwen2.5-coder:7b","prompt":"Count 1 to 3","stream":true}'

=> NDJSON lines:
   {"model":"qwen2.5-coder:7b","response":"Sure","done":false}
   {"model":"qwen2.5-coder:7b","response":"!","done":false}
   {"model":"qwen2.5-coder:7b","response":" Here","done":false}
   ...
```

### Test Cloud Provider qua proxy (without API key)
```bash
$ curl -X POST http://localhost:4455/api/chat -d '{"provider":"cloud","model":"...","prompt":"Hello","stream":false}'

=> HTTP 400
=> {"error":"missing_api_key","message":"Cloud provider requires apiKey"}
```

### Test Cloud Provider qua proxy (with FAKE API key)
```bash
$ curl -X POST http://localhost:4455/api/chat -d '{"provider":"cloud","apiKey":"ollama-test-key-not-real","model":"...","prompt":"Hello","stream":false}'

=> HTTP 401
=> {"error":"upstream_error","provider":"cloud","status":401,"detail":"{\"error\":\"Unauthorized\"}\n"}
```
=> **Proof proxy da forward request den Ollama Cloud that su** - Cloud tra 401 vi key fake.

### Test Cloud Provider qua proxy (with REAL API key - can user nhap)
Khi user nhap API key that trong UI `/ai/settings`:
1. Angular luu vao localStorage `ai_settings_v2.cloudApiKey`
2. User click "Test Connection"
3. CloudProvider.testConnection() POST `/api/chat` voi body co `apiKey`
4. Proxy forward den Cloud voi header `Authorization: Bearer <apiKey>
5. Cloud verify key, goi model, tra response 200
6. Browser nhan response, UI hien thi "Connected" + preview

### Test Browser that (Chrome headless)
Chrome browser that load `http://localhost:4453/test-proxy.html` (Angular SSR origin) va goi `/api/chat`:

```
S1 Origin=http://localhost:4453
S2 POST /api/chat provider=local
S3 status=200
S4 response=Hello! How can I assist you today?
S5 POST /api/chat provider=cloud (no key, expect 400)
S6 status=400
S7 body={"error":"missing_api_key","message":"Cloud provider requires apiKey"}
S8 POST /api/chat with fake cloud key
S9 status=401
S10 body={"error":"upstream_error","provider":"cloud","status":401,"detail":"{\"error\":\"Unauthorized\"}\n"}
DONE
```

**Khong co CORS error.** Tat ca request tu browser di qua same-origin proxy thanh cong.

### Test AI Assistant UI
- GET `/ai/` -> HTTP 200, app-ai-assistant render
- GET `/ai/settings/` -> HTTP 200, app-ai-settings render voi UI moi (Endpoint readonly, Cloud API Key chi hien khi Cloud, Model gop, Test Connection button)
- GET `/home/`, `/vocabulary/`, `/kanji-words/` -> HTTP 200

---

## 5. Deployment

### Local dev
- Chay `ng serve` (port 4200) - browser goi proxy qua same-origin
- Hoac `node dist/japanese-vocab-app/server/server.mjs` (port 4000 default) - Express server bao gom Angular SSR + AI proxy

### Vercel
Vercel chi deploy Angular SSR qua `@angular/ssr/node` cua `dist/japanese-vocab-app/server/server.mjs`. Proxy `/api/chat` se chay trong cung process Express. Voi Cloud provider, server-side se forward request den `https://ollama.com/api/generate` - bypass CORS.

### Vercel Serverless Functions (optional, neu SSR khong kha thi)
Tao `api/chat.ts` (~30 dong) forward body tu client sang Ollama Cloud. Client goi `/api/chat` thay vi `/api/chat` proxy. Hien tai SSR proxy da du, khong can them.

---

## 6. Trang thai cuoi cung

- Local Provider: truc tiep `http://localhost:11434` (CORS OK) - PASS
- Cloud Provider: qua proxy `/api/chat` - PASS
- Build: exit 0 - PASS
- Chrome headless test: proxy hoat dong, khong CORS error - PASS
- AI Assistant UI: render 200 - PASS
- Cloud with fake key: 401 tu Ollama Cloud that - PASS (proxy da di den Cloud)
- Cloud with no key: 400 missing_api_key - PASS
- Cloud with REAL key: se tra 200 response that (can user nhap key that trong Settings UI)

**Cloud Provider da duoc refactor de goi qua proxy. Code san sang cho Vercel deployment.**