# INCIDENT_REPORT — Vercel Deployment Failure

> Senior Full Stack Engineer
> Ngày: 2026-06-28
> Project: japanese-vocab-app
> Production URL: https://japanese-vocab-app.vercel.app

---

## Current Architecture

### Local (WORKS ✅)
```
Browser (localhost:3001 hoặc 4000)
  │
  ├── GET /assets/**          → Express static → dist/browser/assets/
  ├── GET /manifest.webmanifest → Express static → dist/browser/ (có file này)
  ├── POST /api/chat          → Express route   → /api/chat handler
  │     ├── provider=local    → http://127.0.0.1:11434/api/generate
  │     └── provider=cloud    → https://ollama.com/api/generate (Bearer auth)
  └── GET /**                 → Angular SSR / pre-rendered HTML
```

### Vercel (BROKEN ❌)
```
Browser (japanese-vocab-app.vercel.app)
  │
  ├── POST /api/chat          → 404 NOT_FOUND ← không có serverless function
  ├── GET /manifest.webmanifest → 404 ← file không có trong output
  ├── GET /                   → index.csr.html ← có thể 404 nếu Vercel tìm index.html
  └── GET /**                 → Angular routes ← không có SPA fallback config
```

---

## Findings

### ISSUE #1 — CRITICAL: Không có `vercel.json`
- **File:** (không tồn tại)
- Vercel không biết:
  - Build command là gì
  - Output directory ở đâu
  - Cách route request
  - Có serverless function nào không
- Vercel auto-detect Angular framework nhưng không hiểu Angular SSR + Express

### ISSUE #2 — CRITICAL: Không có `api/chat.ts` (Vercel Function)
- **File:** (không tồn tại)
- Express route `POST /api/chat` trong `server.ts` chỉ chạy khi Express server đang sống
- Vercel KHÔNG chạy `node server.mjs` — nó chỉ deploy static files + serverless functions
- Kết quả: mọi POST /api/chat đều 404

### ISSUE #3 — HIGH: `manifest.webmanifest` không có trong build output
- **File:** `public/manifest.webmanifest` (tồn tại)
- **angular.json assets:**
  ```json
  "assets": [
    { "glob": "**/*", "input": "src/assets", "output": "assets" }
  ]
  ```
- `public/` KHÔNG được liệt kê trong assets → không copy vào `dist/browser/`
- Xác nhận: `dist/browser/` không có `manifest.webmanifest`, `favicon.ico`
- Vercel serve static từ `dist/browser/` → file không tồn tại → 404

### ISSUE #4 — HIGH: `index.csr.html` thay vì `index.html`
- Angular 19 SSR với `outputMode: server` tạo ra `index.csr.html` (Client Side Rendering fallback)
- Vercel mặc định tìm `index.html` cho root path `/`
- Không có redirect/rename → root path có thể 404 hoặc trả về HTML sai

### ISSUE #5 — MEDIUM: `ngsw-config.json` vẫn cache `/api/ai/chat` (endpoint đã xóa)
- **File:** `ngsw-config.json` dòng dataGroups
  ```json
  { "name": "ai-chat", "urls": ["/api/ai/chat"], ... }
  ```
- `/api/ai/chat` đã bị xóa khỏi `server.ts` trong lần fix trước
- Service worker sẽ cố cache một endpoint không tồn tại → request fail silently
- `ngsw.json` (compiled) cũng chứa pattern `\/api\/ai\/chat`

### ISSUE #6 — MEDIUM: Vercel Serverless timeout cho AI streaming
- Vercel Hobby plan: **10 giây** max function duration
- Vercel Pro plan: 60 giây
- Ollama Cloud inference có thể mất 30-60+ giây
- Cần set `maxDuration` trong function config

### ISSUE #7 — LOW: `package.json` thiếu `vercel-build` script
- Vercel chạy `npm run vercel-build` nếu có, hoặc fallback `npm run build`
- `npm run build` = `ng build` → OK nhưng không handle rename `index.csr.html`
- Cần thêm step copy file sau build

### ISSUE #8 — LOW: SPA routing không được config cho Vercel
- Angular dùng client-side routing (HTML5 history API)
- Khi user navigate trực tiếp đến `/vocabulary/` hoặc `/ai`, Vercel trả 404
- Cần catch-all rewrite `/* → /index.csr.html` (hoặc `/index.html` sau rename)

---

## Root Cause Candidates

### HIGH confidence
| # | Cause | Evidence |
|---|---|---|
| 1 | Không có `vercel.json` | File không tồn tại, Vercel không biết cách deploy |
| 2 | Không có `api/chat.ts` Vercel Function | `server.ts` không được chạy trên Vercel |
| 3 | `manifest.webmanifest` không có trong build output | `angular.json` assets thiếu `public/` |

### MEDIUM confidence
| # | Cause | Evidence |
|---|---|---|
| 4 | `index.csr.html` thay vì `index.html` | Angular 19 naming convention, Vercel tìm `index.html` |
| 5 | Service worker chặn request vào `/api/ai/chat` cũ | `ngsw-config.json` vẫn còn URL cũ |

### LOW confidence
| # | Cause | Evidence |
|---|---|---|
| 6 | Vercel timeout cho Ollama streaming | Hobby plan giới hạn 10s |
| 7 | SPA routing 404 | Angular routing cần server-side fallback |

---

## Missing Pieces (cần tạo/sửa)

| File | Trạng thái | Action |
|---|---|---|
| `vercel.json` | MISSING | TẠO MỚI |
| `api/chat.ts` | MISSING | TẠO MỚI (Vercel serverless function) |
| `angular.json` assets `public/` entry | MISSING | THÊM VÀO |
| `ngsw-config.json` dataGroup `ai-chat` | SAI URL | SỬA |
| `package.json` `vercel-build` script | MISSING | THÊM VÀO |

---

## Why Local Works

1. **Express server chạy** (`node dist/.../server.mjs` hoặc `ng serve`)
2. **`/api/chat` route có trong Express** — được đăng ký trước Angular handler
3. **Static files** được serve từ `dist/browser/` bởi Express middleware
4. **manifest.webmanifest** nằm trong `public/` và Angular `ng serve` tự serve `public/` natively
   (Angular dev server có built-in public dir support, nhưng production build KHÔNG copy nếu không config)
5. **CORS không thành vấn đề** — same origin (`localhost:3001` → `localhost:3001/api/chat`)

## Why Vercel Fails

1. **Vercel KHÔNG chạy Express** — nó deploy static files + serverless functions
2. **Không có `vercel.json`** → Vercel auto-detect nhưng cấu hình sai
3. **`/api/chat` không phải Vercel Function** → 404 khi gọi
4. **`manifest.webmanifest` không có trong `dist/browser/`** → 404
5. **SPA routing không được config** → direct URL navigation → 404

---

## Recovery Plan đính kèm ở cuối file

Thứ tự thực hiện (theo priority):
1. Tạo `vercel.json`
2. Tạo `api/chat.ts`
3. Fix `angular.json` assets
4. Fix `ngsw-config.json`
5. Fix `package.json` `vercel-build`
6. Build + test local
7. Deploy Vercel + verify
