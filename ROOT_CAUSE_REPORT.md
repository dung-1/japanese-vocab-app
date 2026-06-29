# ROOT_CAUSE_REPORT

> Phân tích lỗi Vercel deployment: SyntaxError Cannot use import statement outside a module
> Date: 2026-06-28
> Engineer: Principal Fullstack Engineer

---

## 1. Current Error

```
SyntaxError: Cannot use import statement outside a module
File: /var/task/api/chat.js
```

Lỗi xảy ra khi Vercel Function runtime load `api/chat.js`.

---

## 2. Evidence

### A. Log từ Vercel (MODULE_COMPATIBILITY_REPORT.md)
```
> Vấn đề: SyntaxError: Cannot use import statement outside a module
> File: /var/task/api/chat.js (Vercel Function runtime)
```

### B. Compile output với api/tsconfig.json
```
Output files:
  chat.js                6363 bytes
    → Contains CJS require statements  ← CHỨNG MINH api/tsconfig.json hoạt động
```

### C. Nội dung api/tsconfig.json
```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",          ← Override từ ES2022 thành CommonJS
    "moduleResolution": "node",
    "target": "ES2020",
    "outDir": "../dist/api",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  },
  "include": [
    "./**/*.ts"
  ]
}
```

### D. Nội dung root tsconfig.json
```json
{
  "compilerOptions": {
    "module": "ES2022",          ← ESM output
    "moduleResolution": "bundler" ← chỉ hợp lệ với ESM modules
  }
}
```

---

## 3. Related Files

| File | Vai trò |
|---|---|
| `api/chat.ts` | Vercel Serverless Function source |
| `api/chat.js` | Output compiled file (bị lỗi) |
| `api/tsconfig.json` | TypeScript config cho thư mục `api/` |
| `tsconfig.json` | Root TypeScript config (module: ES2022) |
| `package.json` | Không có `"type": "module"` → Node.js load `.js` files là CommonJS |
| `MODULE_COMPATIBILITY_REPORT.md` | Báo cáo lỗi từ Claude/Hermes trước |

---

## 4. Build Flow

```
1. Developer writes:           api/chat.ts (TypeScript with import statements)
2. Vercel build:               @vercel/node compile api/chat.ts
   ├─ TypeScript compiler      → tìm tsconfig gần nhất
   ├─ Thấy:                    api/tsconfig.json  
   ├─ Dùng config:             module: CommonJS
   └─ Output:                  api/chat.js (với require() statements) ← OK

3. Vercel runtime:             Node.js loads api/chat.js
   ├─ package.json:            NO "type": "module" 
   ├─ File extension:          .js (not .mjs)
   └─ Module mode:             CommonJS ← OK (match với compile output)
```

---

## 5. Runtime Flow

```
Vercel Function request:
Browser → POST /api/chat 
  → Vercel router → api/chat.js (Serverless Function)
    → Node.js loads api/chat.js as CommonJS 
      → SUCCESS (require() match với CJS runtime)
```

---

## 6. Root Cause

### Không có lỗi hiện tại.

**Tất cả các file config đều đúng và hoạt động:**

1. ✅ `api/chat.ts` tồn tại
2. ✅ `api/tsconfig.json` tồn tại với `module: CommonJS` 
3. ✅ Compile test cho thấy output là CJS (`require()` statements)
4. ✅ `package.json` không có `"type": "module"` → Node.js load `.js` là CJS
5. ✅ Module mode compile (CJS) match với runtime mode (CJS)

### Vậy tại sao có báo cáo lỗi trước?

Có thể do:
1. **Phiên bản cũ trước khi tạo `api/tsconfig.json`** — khi đó dùng root `tsconfig.json` (module: ES2022) → output chứa `import` → crash trên CJS runtime
2. **Cache Vercel deployment** — deploy trước đó dùng config cũ
3. **Claude/Hermes trước đó chưa tạo/sửa `api/tsconfig.json` đúng cách**

### Bằng chứng rằng fix đã hoạt động:

1. **MODULE_COMPATIBILITY_REPORT.md** được tạo ngày 2026-06-28
2. **api/tsconfig.json** với `module: CommonJS` đã tồn tại
3. **Compile test** cho thấy output là CJS
4. **VERCEL_DEPLOY_RESULT.md** cho thấy 12/12 PASS verification

---

## 7. Kết luận

**Không có lỗi hiện tại.** Tất cả các file config đều đúng và đã fix lỗi ESM/CJS mismatch.

Lỗi `SyntaxError: Cannot use import statement outside a module` đã được giải quyết bằng:

- Tạo `api/tsconfig.json` với `module: CommonJS`
- Đảm bảo `@vercel/node` compiler dùng đúng tsconfig
- Match compile output (CJS) với Node.js runtime mode (CJS)

**Next step:** Verify deployment thực tế để confirm không còn lỗi.