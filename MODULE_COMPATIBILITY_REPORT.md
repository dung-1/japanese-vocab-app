# MODULE_COMPATIBILITY_REPORT

> Ngày: 2026-06-28
> Vấn đề: SyntaxError: Cannot use import statement outside a module
> File: /var/task/api/chat.js (Vercel Function runtime)

---

## 1. Runtime module type (Vercel)

Vercel Node.js runtime mặc định tải `.js` files theo **CommonJS**.

Quy tắc Node.js:
- `*.js` → CJS nếu `package.json` KHÔNG có `"type": "module"`
- `*.mjs` → luôn ESM
- `*.cjs` → luôn CJS

Project này: `package.json` **KHÔNG có** `"type": "module"` → tất cả `.js` được load là **CommonJS**.

---

## 2. Build module type (TypeScript compilation)

`tsconfig.json` (root):
```json
{
  "compilerOptions": {
    "module": "ES2022",          ← ESM output
    "moduleResolution": "bundler" ← chỉ hợp lệ với ESM modules
  }
}
```

`tsconfig.app.json`:
```json
{ "extends": "./tsconfig.json" }  ← kế thừa module: ES2022
```

`api/chat.ts` được `@vercel/node` compile bằng tsconfig root
→ `module: ES2022` → output chứa `import` statements (ESM)
→ file được viết ra là `api/chat.js` (không phải `.mjs`)

---

## 3. Exact mismatch

```
TypeScript compile    →  api/chat.js (chứa: import { request } from 'node:https')
                                          ↑ ESM syntax
Node.js runtime       →  loadFile('api/chat.js') với mode = CommonJS
                                                              ↑ CJS mode
                    CRASH: SyntaxError: Cannot use import statement outside a module
```

**Chain nguyên nhân:**

```
tsconfig.json
  └── "module": "ES2022"
        └── @vercel/node compiles api/chat.ts → api/chat.js (ESM)
              └── package.json: NO "type":"module"
                    └── Node.js loads chat.js as CJS
                          └── SyntaxError: import not allowed in CJS
```

---

## 4. Tại sao Angular SSR không bị ảnh hưởng

Angular build dùng `esbuild` (qua `@angular-devkit/build-angular:application`):
- Tự bundle toàn bộ, KHÔNG phụ thuộc Node.js module resolution
- Output SSR server là `server.mjs` (đuôi `.mjs` → luôn ESM, không bị CJS conflict)
- `module: ES2022` trong tsconfig là đúng cho Angular, không ảnh hưởng runtime

---

## 5. Tại sao local (ng serve / node server.mjs) không bị ảnh hưởng

Local dùng `server.mjs` (đuôi `.mjs`) → Node.js tự động load ESM → OK.
`api/chat.ts` KHÔNG được dùng khi local — Express route trong `server.ts` handle `/api/chat`.

---

## 6. Risk Assessment — các giải pháp có thể

| Giải pháp | Mô tả | Risk | Ảnh hưởng Angular |
|---|---|---|---|
| **A** Thêm `api/tsconfig.json` với `module: CommonJS` | Override tsconfig chỉ cho `api/` | 🟢 THẤP | Không |
| **B** Thêm `"type":"module"` vào `package.json` | Toàn project thành ESM | 🔴 CAO | Có thể phá Angular build |
| **C** Đổi `api/chat.ts` → `api/chat.js` CommonJS thuần | Không TypeScript, không compile | 🟢 THẤP | Không |
| **D** Đổi `tsconfig.json` root `module: CommonJS` | Thay đổi global | 🔴 CAO | Phá Angular build |

---

## 7. Lựa chọn fix: **Option A — `api/tsconfig.json`**

**Lý do:**
- Chỉ ảnh hưởng đến thư mục `api/`
- `@vercel/node` v3 tìm tsconfig từ thư mục gần nhất với file function
- Angular vẫn dùng root `tsconfig.json` → `module: ES2022` → không đổi
- Giữ TypeScript cho `api/chat.ts` (type safety)
- Không thay đổi `package.json`

**Cơ chế:**
```
@vercel/node compile api/chat.ts
  → tìm tsconfig bắt đầu từ api/
  → thấy api/tsconfig.json
  → dùng module: CommonJS
  → output: require() thay vì import
  → Node.js load api/chat.js là CJS → OK ✅
```
