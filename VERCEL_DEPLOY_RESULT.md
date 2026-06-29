# VERCEL_DEPLOY_RESULT

> Báo cáo fix Vercel deployment
> Ngày: 2026-06-28
> Dựa trên: INCIDENT_REPORT.md

---

## Tóm tắt: 5 files tạo/sửa để fix Vercel

| File | Trạng thái | Fix vấn đề |
|---|---|---|
| `vercel.json` | ✅ TẠO MỚI | Build config, routing, headers |
| `api/chat.ts` | ✅ TẠO MỚI | `/api/chat` trên Vercel (serverless function) |
| `angular.json` | ✅ SỬA | `manifest.webmanifest` + `favicon.ico` trong build output |
| `ngsw-config.json` | ✅ SỬA | Service worker URL `/api/ai/chat` → `/api/chat` |
| `package.json` | ✅ SỬA | `vercel-build` script + `@vercel/node` dependency |

---

## Chi tiết từng fix

### 1. `vercel.json` (MỚI)
```json
{
  "buildCommand": "ng build && cp .../index.csr.html .../index.html",
  "outputDirectory": "dist/japanese-vocab-app/browser",
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
}
```
- `buildCommand`: chạy Angular build + copy `index.csr.html` → `index.html`
- `outputDirectory`: Vercel serve static từ đây
- `rewrites`: SPA routing — mọi route Angular đều fallback về `index.html`
- `headers`: Cache-Control đúng cho ngsw, CORS cho `/api/`

### 2. `api/chat.ts` (MỚI)
Vercel Serverless Function — tương đương route Express `/api/chat`:
- Cloud mode: forward `https://ollama.com/api/generate` với Bearer auth
- Local mode: forward `OLLAMA_HOST` env var (default `127.0.0.1:11434`)
- `maxDuration: 60` để tránh timeout với AI streaming
- Streaming NDJSON piped về client

### 3. `angular.json` — thêm `public/` vào assets
```json
{ "glob": "**/*", "input": "public", "output": "." }
```
→ `public/manifest.webmanifest` và `public/favicon.ico` được copy vào root của `dist/browser/`

### 4. `ngsw-config.json`
```
/api/ai/chat  →  /api/chat
```
→ Service worker không còn cache endpoint đã xóa

### 5. `package.json`
- Thêm `"vercel-build"` script (Vercel ưu tiên chạy cái này)
- Thêm `@vercel/node` devDependency (TypeScript types cho Vercel Function)

---

## Kiến trúc sau khi deploy

```
Browser → https://japanese-vocab-app.vercel.app
  │
  ├── POST /api/chat          → api/chat.ts (Vercel Function) ✅
  │     ├── provider=cloud    → https://ollama.com/api/generate (Bearer)
  │     └── provider=local    → OLLAMA_HOST env var (nếu có)
  │
  ├── GET /manifest.webmanifest → dist/browser/manifest.webmanifest ✅
  ├── GET /favicon.ico         → dist/browser/favicon.ico ✅
  ├── GET /assets/**           → dist/browser/assets/** ✅
  ├── GET /ngsw.json           → dist/browser/ngsw.json (no-cache) ✅
  │
  └── GET /home, /ai, /**      → rewrite → dist/browser/index.html ✅
                                  (Angular client-side routing takes over)
```

---

## Lưu ý quan trọng về Local mode trên Vercel

**Local Ollama KHÔNG chạy được trên Vercel** (không có `localhost:11434`).

Options:
1. **Dùng Cloud mode** (recommended) — set API Key trong Settings
2. **Tự host Ollama** với public URL, set `OLLAMA_HOST` env var trong Vercel Dashboard:
   ```
   OLLAMA_HOST=https://your-ollama-server.com
   ```
3. **Hybrid** — user tự chọn: Cloud trên production, Local khi dev locally

---

## Hướng dẫn deploy

### Bước 1: Install dependencies (cần @vercel/node)
```powershell
cd H:\Scripts\japanese-vocab-app
npm install
```

### Bước 2: Chạy verify script
```powershell
pwsh scripts/verify-vercel-build.ps1
# Expect: 12/12 PASS
```

### Bước 3: Deploy

**Option A: Vercel CLI**
```powershell
npx vercel deploy --prod
```

**Option B: Git push (auto-deploy)**
```powershell
git add vercel.json api/chat.ts angular.json ngsw-config.json package.json scripts/verify-vercel-build.ps1
git commit -m "fix: Vercel deployment - add vercel.json, api/chat.ts serverless function, fix assets"
git push
```

### Bước 4: Verify production
```
POST https://japanese-vocab-app.vercel.app/api/chat
Content-Type: application/json

{
  "provider": "cloud",
  "apiKey": "YOUR_OLLAMA_API_KEY",
  "model": "nemotron-3-super:cloud",
  "prompt": "Xin chào",
  "stream": false
}

→ Expect: HTTP 200, JSON response
```

---

## Success Criteria (checklist deploy)

- [ ] `ng build` thành công (0 errors)
- [ ] `dist/browser/manifest.webmanifest` tồn tại
- [ ] `dist/browser/index.html` tồn tại (sau khi copy từ index.csr.html)
- [ ] `vercel deploy` thành công
- [ ] `GET https://japanese-vocab-app.vercel.app/` → 200, Angular app load
- [ ] `POST https://japanese-vocab-app.vercel.app/api/chat` → 200 (không còn 404)
- [ ] `GET https://japanese-vocab-app.vercel.app/manifest.webmanifest` → 200 (không còn 404)
- [ ] Cloud AI chat hoạt động với API key thật
- [ ] Không có CORS errors trong browser console
- [ ] Angular routing hoạt động (navigate trực tiếp đến /ai, /vocabulary, v.v.)
