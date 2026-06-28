# FIX_PLAN

> Kế hoạch sửa lỗi chi tiết — dựa trên AUDIT_REPORT.md
> Ngày: 2026-06-28

---

## FIX #1 — CRITICAL: Cloud proxyUrl sai trong testConnection()

- **Root cause:** `CLOUD_ENDPOINT = 'https://ollama.com/api/generate'` được truyền làm `proxyUrl`
- **File:** `src/app/ai/components/ai-settings/ai-settings.component.ts`
- **Thay đổi:** Xóa argument thứ 3 khỏi `configureCloud()` → giữ default `/api/chat`
- **Risk:** Thấp — chỉ xóa 1 argument

## FIX #2 — CRITICAL: Default model sai

- **Root cause:** `model: 'nemotron-3-super:cloud'` không tồn tại ở local
- **Files:** `src/app/ai/models/ai-chat.model.ts`, `src/environments/environment.ts`, `src/environments/environment.prod.ts`
- **Thay đổi:** Đổi sang `qwen3:0.6b` (đã xác nhận có local)
- **Risk:** Thấp

## FIX #3 — MODERATE: Dọn server.ts

- **Root cause:** Endpoint `/api/ai/chat` cũ còn thừa
- **File:** `src/server.ts`
- **Thay đổi:** Xóa route `/api/ai/chat`
- **Risk:** Thấp — OllamaService dead code, không ai gọi

## FIX #4 — LOW: Xóa CLOUD_ENDPOINT constant gây nhầm lẫn

- **File:** `src/app/ai/components/ai-settings/ai-settings.component.ts`
- **Thay đổi:** Đổi tên `CLOUD_ENDPOINT` → `CLOUD_UPSTREAM_DISPLAY` để rõ mục đích chỉ hiển thị UI
- **Risk:** Không có
