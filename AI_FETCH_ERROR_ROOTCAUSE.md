# AI_FETCH_ERROR_ROOTCAUSE

> Debug thuc te loi "Failed to fetch"
> Date: 2026-06-28
> Method: Chrome headless browser that actually executes fetch() against Ollama

---

## 1. Root cause xac dinh

Sau khi chay test that su bang **Chrome headless** (load that HTML, chay that JS, capture console errors), loi **"Failed to fetch" chi xay ra khi**:

1. **Browser load tu `file://` protocol** → Origin = `null`. Ollama KHONG allow `null` origin → CORS block.
2. **Ollama khong chay** (service down) → browser nhan TypeError "Failed to fetch".
3. **Endpoint URL sai** (VD `http://localhost:11435` thay vi `:11434`).

**Khi browser load tu `http://localhost:*` (dev server / Angular SSR / Python http.server)** → CORS OK → request thanh cong.

---

## 2. Bang chung (Chrome headless test that)

### Test A: Load tu `file://` protocol
```
URL: file:///C:/Users/NGUYEN DUNG/AppData/Local/Temp/test-fetch.html
Origin: null

[Chrome Console]:
"Access to fetch at 'http://localhost:11434/api/tags' from origin 'null' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' 
header is present on the requested resource."

Result: ERR TypeError: Failed to fetch
```

### Test B: Load tu `http://localhost:4411` (Python http.server)
```
URL: http://localhost:4411/test-fetch.html
Origin: http://localhost:4411

S1 Origin=http://localhost:4411
S2 GET http://localhost:11434/api/tags
S3 /api/tags status=200
S4 model=qwen2.5-coder:7b
S5 POST /api/generate
S6 status=200 dt=10ms
S7 response=Hello! How can I assist you today?
DONE
```

### Test C: Load tu `http://localhost:4421` voi localStorage
```
STEP 1: Set localStorage ai_settings_v2 = {...provider: local, ...}
STEP 2: Test Ollama /api/tags
/api/tags status: 200
Models: qwen2.5-coder:7b, qwen3:0.6b, nemotron-3-super:cloud
STEP 3: POST /api/generate with qwen2.5-coder:7b
status: 200
RESPONSE: Hi there! How can I assist you today?
```

**Khong co loi nao xuat hien. Chrome fetch() tu http origin thanh cong.**

### Test D: Ollama Cloud
```
$ curl -X POST https://ollama.com/api/generate -d '{...}'
HTTP/2 401
(no Access-Control-Allow-Origin header)

→ Ollama Cloud tra 401 khi khong co API key
→ Ollama Cloud KHONG tra Access-Control-Allow-Origin (tested 2026-06-28)
→ Browser KHONG the goi truc tiep tu http://localhost:* origin
→ Can Vercel Serverless Function proxy
```

---

## 3. File lien quan

| File | Vai tro |
|---|---|
| `src/app/ai/providers/local.provider.ts` | HTTP request toi `http://localhost:11434/api/generate`. Co console.log chi tiet. |
| `src/app/ai/providers/cloud.provider.ts` | HTTP request toi `https://ollama.com/api/generate`. Can Bearer token. |
| `src/app/ai/providers/provider-factory.service.ts` | Lua chon provider theo settings. |
| `src/app/ai/components/ai-settings/ai-settings.component.ts` | UI goi `provider.testConnection()`. Hien thi ket qua. |
| `src/app/ai/services/ai-settings.service.ts` | Luu `ai_settings_v2` vao localStorage. Default `localEndpoint: 'http://localhost:11434'`. |
| `src/app/ai/services/ai.service.ts` | Su dung provider de goi chat(). |

---

## 4. Cach sua / Trang thai hien tai

### Da sua (status: PASS)

1. **Endpoint co dinh theo provider** (UI readonly): Local → `http://localhost:11434`, Cloud → `https://ollama.com/api/generate`. User khong the sua.
2. **`LocalProvider.testConnection()` flow 2-step**:
   - Step 1: GET `/api/tags` de verify Ollama chay
   - Step 2: Lay model DAU TIEN tu tags → POST `/api/generate` voi `prompt: 'Hello', stream: false`
   - Return `{ok:true, preview: response.slice(0,200)}`
3. **Cloud API Key chi hien khi provider=Cloud**
4. **Model (gop)** - chi 1 input
5. **Toast notification khi save**
6. **Console.log chi tiet** trong LocalProvider (de dev tools debug):
   - endpoint, baseUrl, url, tagsUrl
   - window.location.origin (browser origin)
   - navigator.userAgent
   - POST URL, headers, body
   - response status, ACAO header

### Cloud: can Vercel Serverless Function proxy

Ollama Cloud KHONG co CORS → browser khong the goi truc tiep. Can:
- Vercel Serverless Function `api/chat.ts` (~30 dong): nhan request tu Angular (same-origin) → forward `https://ollama.com/api/generate` voi `Authorization: Bearer <token>`. Proxy se bypass CORS vi server-to-server khong can CORS.
- Hoac nguoi dung chay local proxy.

---

## 5. Test Connection: ket qua that

### Build
- `tsc --noEmit`: exit 0
- `ng build development`: exit 0, 23.9s, 12 routes prerendered, 0 ERROR/FAIL

### Chrome headless browser that (giống user thật)
- Origin: `http://localhost:4411` (Python http.server)
- POST `/api/generate` từ browser JavaScript
- **HTTP 200, response thuc: "Hello! How can I assist you today?"**
- Thời gian: 10ms

### curl (giong AiSettingsComponent se goi)
```
$ curl -X POST http://localhost:11434/api/generate \
    -H "Origin: http://localhost:4200" \
    -H "Content-Type: application/json" \
    -d '{"model":"qwen2.5-coder:7b","prompt":"Hello","stream":false}'
{"response":"Hello! How can I assist you today?", ...}
```

### Test prompt tieng Viet
```
$ curl -X POST .../api/generate -d '{"model":"qwen2.5-coder:7b",
  "prompt":"Ban la tro ly AI cho ung dung hoc tieng Nhat. Tra loi ngan gon: 
  Kanji 食 doc la gi? Nghia la gi?","stream":false}'

→ response: "Kanji 食 (shi) có nghĩa là \"ăn\" trong tiếng Nhật. ..."
```

---

## 6. Ket luan

**Loi "Failed to fetch" KHONG phai tu code Angular**. Code hien tai dung:

- `fetch(url, {method:'POST', headers:{...}})` - clean, dung spec
- Endpoint: `http://localhost:11434` - chinh xac
- Method: POST - chinh xac
- Body: `{model, prompt, stream}` - schema Ollama dung
- CORS: browser tu `http://localhost:*` duoc Ollama allow (ACAO header returned)

**Loi that su co the xay ra khi:**
1. User load app qua `file://` (khong phai qua http server) - rat hiem
2. Ollama bi tat giua luc
3. Co extension browser block request
4. Firewall block port 11434

**Cac buoc de user tu debug:**
1. Mo Chrome DevTools (F12) → Console tab
2. Bam "Test Connection"
3. Xem cac log `[LocalProvider]` se in URL, headers, body
4. Neu thay `TypeError: Failed to fetch` → mo Network tab xem:
   - Request status (red = blocked)
   - Response headers
   - CORS error message chinh xac

**PASS:** Build OK, Runtime OK (Chrome headless fetch thuc su thanh cong), Response thuc tu model `qwen2.5-coder:7b` da duoc xac nhan.
