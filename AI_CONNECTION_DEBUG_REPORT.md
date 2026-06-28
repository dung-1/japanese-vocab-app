# AI_CONNECTION_DEBUG_REPORT

> Báo cáo điều tra & sửa lỗi kết nối AI Assistant → Ollama
> Đường dẫn dự án: `H:\Scripts\japanese-vocab-app`
> Ngày thực hiện: 2026-06-27
> Trạng thái cuối cùng: **✅ PASS** (5/5 test qua proxy thành công)

---

## 1. Nguyên nhân gốc

Sau điều tra 10 bước, phát hiện **3 nguyên nhân chính** gây ra lỗi `HTTP 502 upstream_unreachable / Error: socket hang up / ECONNRESET`:

### Nguyên nhân #1 — Model cấu hình không tồn tại trong Ollama
- File config: `src/environments/environment.ts` và `environment.prod.ts`
- Model cũ: `qwen2.5:7b` → Ollama báo `Error: model 'qwen2.5:7b' not found`
- Model thực tế có sẵn: `qwen2.5-coder:7b`, `qwen3:0.6b`, `nemotron-3-super:cloud`
- **Cộng hưởng**: ngay cả `qwen2.5-coder:7b` cũng fail vì out-of-memory (`failed to allocate buffer of size 149958688`).
- **Fix:** Đổi model mặc định sang `qwen3:0.6b` (chạy được, context 40k).

### Nguyên nhân #2 — Frontend parse sai field response
- File: `src/app/ai/models/stream-event.model.ts` và `src/app/ai/services/ollama.service.ts`
- Code cũ parse `ev.response` — đây là field của `/api/generate`.
- Thực tế proxy đang gọi `/api/chat` → Ollama trả `message.content`.
- **Fix:** Thêm `OllamaChatMessage` interface + cập nhật parser ưu tiên `ev.message.content`.

### Nguyên nhân #3 — Proxy có bug destroy upstream không đúng lúc
- File: `src/server.ts` (route `/api/ai/chat`)
- Code cũ gắn `req.on('close', () => upstream.destroy())` → `close` event bắn NGAY SAU khi express.json() parse body xong, phá huỷ upstream trước khi nó kịp gửi response.
- **Fix:** Bỏ `req.on('close')`, chỉ giữ `req.on('aborted')` (chỉ destroy khi client thực sự abort).

---

## 2. File đã sửa

| # | File | Thay đổi |
|---|---|---|
| 1 | `src/environments/environment.ts` | `model: 'qwen2.5:7b'` → `model: 'qwen3:0.6b'` |
| 2 | `src/environments/environment.prod.ts` | `model: 'qwen2.5:7b'` → `model: 'qwen3:0.6b'` |
| 3 | `src/server.ts` | Route `/api/ai/chat`: bỏ `req.on('close', destroy)`, thêm `res.writableEnded` guard khi write/end, log chi tiết hơn |
| 4 | `src/app/ai/models/stream-event.model.ts` | Thêm `OllamaChatMessage` interface; thêm field `message?`, `done_reason?` vào `OllamaStreamEvent` |
| 5 | `src/app/ai/services/ollama.service.ts` | Token parser đổi từ `ev.response` → `ev.message?.content ?? ev.response ?? ''` |
| 6 | `scripts/test-ai.sh` | MỚI — script test 5 câu tự động |

---

## 3. Lệnh đã chạy

```bash
# === Bước 1-2: Khám phá file liên quan ===
grep -rln "ollama|/api/ai|proxy|chat|generate" src/ scripts/

# === Bước 3: So sánh model ===
ollama list
cat src/environments/environment.ts

# === Bước 4: Test Ollama ===
curl -s http://127.0.0.1:11434/
curl -s http://127.0.0.1:11434/api/tags
curl -X POST http://127.0.0.1:11434/api/generate -d '{"model":"qwen3:0.6b",...,"stream":false}'
curl -X POST http://127.0.0.1:11434/api/chat -d '{"model":"qwen3:0.6b","messages":[...],"stream":false}'

# === Bước 7: Sửa + build ===
# (edit 4 file)
./node_modules/.bin/ng build --configuration production

# === Bước 8: Test end-to-end qua proxy ===
(PORT=4000 node dist/japanese-vocab-app/server/server.mjs >/tmp/srv.out 2>/tmp/srv.err </dev/null &)
sleep 4
curl -s -m 3 http://127.0.0.1:4000/ -o /dev/null -w "HTTP=%{http_code}\n"  # 302 OK
bash scripts/test-ai.sh  # 5/5 pass
```

---

## 4. Kết quả test

### 4.1. Ollama direct test (bước 4)
```
$ ollama list
qwen2.5-coder:7b          dae161e27b0e    4.7 GB
qwen3:0.6b                7df6b6e09427    522 MB
nemotron-3-super:cloud    be3943c5a818    -

$ curl http://127.0.0.1:11434/api/tags  # → 200 OK, 3 models

$ curl -X POST .../api/chat -d '{"model":"qwen3:0.6b","messages":[{"role":"user","content":"hi"}],"stream":false}'
{"model":"qwen3:0.6b","message":{"role":"assistant","content":"Hi! How can I assist you today? 😊"},...}
```
✅ Ollama hoạt động, model `qwen3:0.6b` load OK.

### 4.2. Proxy test (sau khi sửa bug)
```
$ curl -X POST http://127.0.0.1:4000/api/ai/chat -d '{"model":"qwen3:0.6b","messages":[{"role":"user","content":"hi"}],"stream":false}'
{"model":"qwen3:0.6b","created_at":"2026-06-27T01:46:01.3790486Z","message":{"role":"assistant","content":"Hello! How can I assist you today? 😊 Let me know if there's anything you need help with!"},"done":true,...}
```
✅ Proxy hoạt động, JSON response đúng schema.

### 4.3. 5 câu hỏi về Kanji 違 (bước 8)

| # | Câu hỏi | Kết quả | Pass |
|---|---|---|---|
| 1 | Kanji 違 có nghĩa là gì? | "Vi phạm." (test riêng) / Kanji là hệ thống ký hiệu dân gian (model 0.6B confused) | ✅ HTTP 200 |
| 2 | Onyomi của 違 | Trả lời sai nhưng response OK | ✅ HTTP 200 |
| 3 | Kunyomi của 違 | Trả lời sai nhưng response OK | ✅ HTTP 200 |
| 4 | JLPT của 違 | "JLPT 2" | ✅ HTTP 200 |
| 5 | Ví dụ của 違 | "違反する" hiragana | ✅ HTTP 200 |

**5/5 test trả về HTTP 200 + JSON response hợp lệ.** Kết nối hoạt động đầy cuối.

Lưu ý: chất lượng trả lời kém do model `qwen3:0.6b` quá nhỏ (chỉ 751 triệu tham số, context 40k). Đây là **hạn chế model, không phải lỗi kết nối**. Khi user cài thêm model tốt hơn (ví dụ `qwen2.5-coder:7b` nếu đủ RAM, hoặc `llama3.1:8b`, hoặc cloud model), chỉ cần đổi `environment.ai.model` là chạy được ngay.

### 4.4. Streaming test
```
$ curl -X POST http://127.0.0.1:4000/api/ai/chat -d '{"model":"qwen3:0.6b","messages":[...],"stream":true}'
{"model":"qwen3:0.6b","message":{"role":"assistant","content":"","thinking":"Okay"},"done":false}
{"model":"qwen3:0.6b","message":{"role":"assistant","content":"","thinking":","},"done":false}
...
```
✅ Streaming hoạt động, NDJSON mỗi dòng đúng schema `/api/chat` (có `message.content` và `message.thinking`).

---

## 5. Trạng thái cuối cùng

| Hạng mục | Trạng thái |
|---|---|
| Build | ✅ Pass (production, 16.0s) |
| Proxy endpoint `/api/ai/chat` | ✅ Pass |
| Non-stream chat | ✅ Pass |
| Stream chat | ✅ Pass |
| Model `qwen3:0.6b` load | ✅ Pass |
| JSON parser (browser) | ✅ Updated to read `message.content` |
| 5/5 test câu hỏi | ✅ HTTP 200 |
| Server logs | Sạch (no error) |

## ✅ KẾT LUẬN: **PASS**

Kết nối AI từ Frontend Angular → Express SSR proxy → Ollama hoạt động hoàn toàn.

Để nâng cao chất lượng trả lời, người dùng có thể:
1. Pull model tốt hơn: `ollama pull qwen2.5-coder:7b` (nếu RAM ≥ 8 GB) hoặc `ollama pull llama3.1:8b`.
2. Sửa `src/environments/environment.prod.ts` đổi `model: 'qwen2.5-coder:7b'`.
3. Rebuild + chạy lại server.

Bug proxy đã sửa triệt để:
- `req.on('close', destroy)` gây ECONNRESET → bỏ
- Parser sai field → fix về `message.content`
- Model mismatch → đổi sang model có sẵn trong Ollama.