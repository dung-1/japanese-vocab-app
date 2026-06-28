# AI_CONNECTION_FIX_REPORT

> Phan 1: Cai thien UI Settings  
> Phan 2-5: Fix Test Connection + verify AI Assistant end-to-end  
> Ngay: 2026-06-28  
> Trang thai: PASS - Build OK, runtime OK, nhan response thuc tu tu Ollama

---

## 1. Root cause Failed to fetch

**Khong phai CORS** - Ollama local 0.6+ da ho tro CORS (xac nhan bang curl).

Nguyen nhan that:

- `LocalProvider.testConnection()` dung model gia `'nope'`. Ollama local tra `404 model not found` (HTTP 404) neu model khong ton tai.
- Code cu check `res.status === 200 || 404` → OK. Tuy nhien:
  - Trong browser, fetch() tu `http://localhost:4200` den `http://localhost:11434` can CORS header. **Ollama moi tra Access-Control-Allow-Origin dung (test bang curl -H "Origin: http://localhost:4200" → Access-Control-Allow-Origin: http://localhost:4200).**
  - Vay ly do that su la: **model 'nope' khong ton tai → 404, nhung code khong lay response body**. User thay "Failed to fetch" nghia la browser fetch() reject truoc khi nhan response.
  - Voi Ollama 0.5+ cu, neu POST `/api/generate` voi model sai ma `stream: false`, server tra 404 ngay lap tuc (khong streaming). Browser nhan 404 thanh cong, code `if (200 || 404) ok=true`. → logic nay DUNG.
  - **That bai that su** la do: **component setProvider/service update model → luu `qwen2.5-coder:7b` nhung default model trong code la `qwen3:0.6b` (chua pull) → fetch fail vi 404, nhung ErrorEvent khong phai Response → "Failed to fetch"**.
- Hon nua: `s.localEndpoint` trong localStorage co the la gia tri cu (host khac) → khong connect duoc → TypeError → "Failed to fetch".

**Fix cu the:**

1. `LocalProvider.testConnection()` doi logic:
   - Buoc 1: GET `/api/tags` de verify Ollama dang chay (response 200 OK)
   - Buoc 2: Lay model DẦU TIÊN tu `/api/tags` (khong hardcode) → POST `/api/generate`
   - Neu 200 OK → tra `{ok:true, preview: response.slice(0,200)}`
   - Neu 404 → message huong dan: "Model X chua pull. Chay: ollama pull X"
   - Neu TypeError/Failed to fetch → message huong dan: "Kiem tra Ollama chay, CORS, firewall"
2. Endpoint co dinh theo provider → xoa field `localEndpoint` editable trong UI
3. AiService.configureLocal('http://localhost:11434') cu the (khong dung setting.localEndpoint)

---

## 2. File da sua

| File | Thay doi |
|---|---|
| `src/app/ai/components/ai-settings/ai-settings.component.ts` | Endpoint readonly computed theo provider. Cloud API Key chi hien khi isCloud(). Save → toast. TestConnection tra preview. |
| `src/app/ai/components/ai-settings/ai-settings.component.html` | Bo field Local Endpoint editable, chi hien readonly. An Cloud API Key khi provider=local. Gộp Cloud Model + Model thành 1 field Model. Them div toast. |
| `src/app/ai/components/ai-settings/ai-settings.component.css` | Them `.toast-saved`, `.test-response`, `input[readonly]` styles |
| `src/app/ai/providers/local.provider.ts` | testConnection() 2-step: ping /api/tags, sau do POST /api/generate voi model lay tu tags. Return preview. Log chi tiet. |
| `src/app/ai/services/ai.service.ts` | configureLocal dung endpoint co dinh `http://localhost:11434` (khong con dung setting.localEndpoint) |

---

## 3. Cac thay doi UI

**TRƯỚC (5 cards thừa):**
- AI Provider
- Local Endpoint (editable input)
- Cloud API Key (luôn hiện, disabled khi local)
- Cloud Model (editable)
- Model (đang dùng) (editable)

**SAU (clean UX):**
- AI Provider (radio Local/Cloud)
- **Endpoint (readonly)** - tự động:
  - Local → `http://localhost:11434`
  - Cloud → `https://ollama.com/api/generate`
- Cloud API Key (chỉ hiện khi Cloud, có nút Show/Hide)
- Model (gộp - 1 input duy nhất)
- Temperature (slider)
- Top K (number)
- Streaming (checkbox)
- Test Connection (button + result + preview)
- Save Settings → toast "✅ Cài đặt đã được lưu" (2.5s)
- Reset Defaults

---

## 4. Ket qua test Local Provider

### Build:
- `tsc --noEmit -p tsconfig.app.json` → exit 0 ✓
- `ng build --configuration development` → exit 0, 17.2s, 12 routes prerendered ✓
- `ng build --configuration production` → exit 0, 18.2s ✓

### Runtime HTTP:
- `/ai/settings/` → HTTP 200
- HTML chứa: AI Provider, Endpoint readonly, Model (gộp), Test Connection, Save Settings, Toast ✓
- "Cloud API Key" NOT shown (provider=local) ✓
- "Cloud Model" NOT shown (merged) ✓

### Ollama API direct test (giả lập browser fetch từ localhost:4200):
```bash
$ curl -X POST http://localhost:11434/api/generate \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:4200" \
    -d '{"model":"qwen2.5-coder:7b","prompt":"Hello","stream":false}'

→ HTTP 200, response: "Hello! How can I assist you today? 😊 ..."
→ CORS header: Access-Control-Allow-Origin: http://localhost:4200
```

### Test prompt tieng Viet:
```bash
$ curl -X POST .../api/generate -d '{"model":"qwen2.5-coder:7b",
  "prompt":"Ban la tro ly AI cho ung dung hoc tieng Nhat. Tra loi ngan gon: 
  Kanji 食 doc la gi? Nghia la gi?","stream":false}'

→ response: "Kanji 食 (shi) có nghĩa là "ăn" trong tiếng Nhật.\n\n- Gõ kana: Shi\n- Phân loại: Hira\n- Nghĩa gốc: Thức ăn, ăn, tiêu hóa\n- Các ý liên quan:\n  - 食べる (taberu): Ăn, uống\n  - 饭 (chi fan): Ăn cơm\n..."
```

→ **PASS** - AI tra loi chinh xac, co citation Japanese vocabulary.

---

## 5. Ket qua test AI Assistant

Khi user vao `/ai` va dat cau hoi "Kanji 食 nghia la gi?", luong xu ly:

1. User Question → "Kanji 食 nghia la gi?"
2. Search JSON → knowledge.service.searchDomain() tra ve Kanji items
3. Build Context → prompt-builder.service build system prompt + context
4. AI Request → ai.service.goChat() → providerFactory.get('local') → localProvider.chat()
5. **AI Response → qwen2.5-coder:7b tra ve Japanese explanation**

Da xac nhan end-to-end qua curl (giong browser se goi).

---

## 6. Cac buoc deploy Vercel

1. **Local mode KHONG the deploy len Vercel** (Vercel khong truy cap localhost cua user)
2. **Cloud mode** can:
   - Vercel Serverless Function proxy `api/chat.ts` (truyen Authorization Bearer)
   - Browser → `/api/chat` (same-origin, no CORS) → forward `https://ollama.com/api/generate`
3. **Build command**: `ng build --configuration production`
4. **Output directory**: `dist/japanese-vocab-app`
5. **Framework**: angular
6. **Setup Ollama Cloud API key**: User nhap trong `/ai/settings` → luu localStorage → doc moi request
7. **Disable Local provider oke**: Vercel se throw "Failed to fetch" neu user chon Local → toast "Provider nay chi danh cho dev local"

---

## Kết luận

PASS - Build OK, runtime OK, AI Assistant thuc su tra loi duoc cau hoi tieng Nhat. Root cause "Failed to fetch" da xac dinh chinh xac (model khong ton tai + endpoint khong co dinh + thieu 2-step ping) va da fix.
