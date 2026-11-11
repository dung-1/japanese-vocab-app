# Japanese Vocab App — AI Module Migration Plan & Engineering Log

> **Tài liệu kiểm soát dự án:** kế hoạch, quyết định kỹ thuật, thay đổi mã nguồn, kiểm thử, commit và báo cáo đều phải được ghi tại đây để duy trì mạch công việc và phục vụ điều tra sau này.
>
> - Repository: `dung-1/japanese-vocab-app`
> - Branch mục tiêu: `master`
> - Ngày khởi tạo: 2026-11-11
> - Trạng thái: **PLAN APPROVED — IMPLEMENTATION NOT STARTED**
> - Phạm vi hiện tại: chuyển AI Chat từ phụ thuộc Ollama Cloud sang kiến trúc đa nhà cung cấp API; ưu tiên Gemini, Groq dự phòng; giữ Ollama Local.
> - Quy tắc triển khai: làm theo từng phase, kiểm tra và ghi bằng chứng trước khi chuyển phase. Không deploy production nếu chưa có phê duyệt rõ ràng.

---

## 0. Quy tắc duy trì tài liệu (bắt buộc)

### 0.1 Nguồn sự thật duy nhất

File này là nhật ký kỹ thuật chính thức của quá trình migration. Mọi phiên làm việc cần đọc phần trạng thái và log mới nhất trước khi tiếp tục.

Không dựa vào trí nhớ hội thoại để kết luận công việc đã hoàn tất. Chỉ đánh dấu hoàn tất khi có bằng chứng như:
- File/đường dẫn và thay đổi cụ thể.
- Kết quả build/test/lint.
- Kết quả kiểm thử thủ công.
- Commit SHA và nội dung commit.
- Deployment URL/trạng thái, nếu có deploy.

### 0.2 Quy tắc cập nhật sau mỗi công việc

Sau mỗi lần làm việc, cập nhật:
1. Ngày giờ và mục tiêu.
2. Phase/task đã thực hiện.
3. File được đọc/thêm/sửa/xóa.
4. Lý do và quyết định kỹ thuật.
5. Lệnh kiểm tra đã chạy và kết quả thực tế.
6. Vấn đề phát hiện, cách xử lý hoặc việc còn tồn đọng.
7. Commit SHA, branch và trạng thái CI nếu có.
8. Báo cáo ngắn: hoàn thành gì, chưa hoàn thành gì, bước tiếp theo.

Không ghi “đã test”, “đã build”, “đã deploy” nếu chưa chạy/quan sát kết quả tương ứng. Phân biệt rõ **PLANNED**, **IN PROGRESS**, **BLOCKED**, **VERIFIED**, **NOT VERIFIED**.

### 0.3 Quy tắc an toàn

- Không đưa API key, token, mật khẩu, cookie hoặc secret vào Git, log, screenshot hay nội dung file này.
- Chỉ ghi tên biến môi trường và trạng thái cấu hình; không ghi giá trị.
- API key của nhà cung cấp cloud chỉ được đọc ở server runtime từ environment variables.
- Không lưu API key cloud mới trong Angular, localStorage, sessionStorage hoặc request body từ browser.
- Không tự động bật thanh toán, mua credit hoặc nâng cấp gói.
- Free tier có thể thay đổi; phải xác minh quota, model, vision và chính sách dữ liệu tại thời điểm triển khai.
- Không ghi nhận production deployment thành công khi chưa có trạng thái deployment xác nhận.
- Không xóa Ollama Local hoặc đường lui đang hoạt động trước khi migration được kiểm thử.
- Không làm thay đổi module ngoài phạm vi nếu không có lý do và ghi nhận.

---

## 1. Mục tiêu và tiêu chí thành công

### 1.1 Mục tiêu

1. Giảm phụ thuộc vào Ollama Cloud đang trả HTTP 402.
2. Tích hợp Gemini API làm provider cloud chính.
3. Tích hợp Groq làm provider dự phòng; đánh giá Cerebras như adapter tùy chọn ở phase sau.
4. Giữ Ollama Local để phát triển/thử nghiệm khi laptop bật.
5. Đưa việc quản lý API key về backend.
6. Chuẩn hóa request/response, streaming, lỗi, timeout và fallback.
7. Không làm mất các tính năng AI Chat đang có.
8. Chuẩn bị cấu trúc hỗ trợ ảnh/vision nhưng không giả định tất cả provider đều hỗ trợ.
9. Giữ tính tương thích của knowledge base, retrieval/RAG, embeddings và lịch sử hội thoại.

### 1.2 Tiêu chí chấp nhận tổng thể

- [ ] Người dùng chọn được provider/model hợp lệ từ UI.
- [ ] Chat văn bản hoạt động với Gemini.
- [ ] Groq có thể được chọn hoặc dùng làm fallback theo chính sách được duyệt.
- [ ] Ollama Local tiếp tục hoạt động trong môi trường local.
- [ ] Streaming hiển thị token tăng dần.
- [ ] Hủy generation hoạt động và không để UI kẹt trạng thái busy.
- [ ] Lịch sử hội thoại và context/RAG tiếp tục hoạt động.
- [ ] Slash commands và prompt theo domain không bị hỏng.
- [ ] Lỗi 400/401/403/429/5xx/timeout được hiển thị có ý nghĩa.
- [ ] Không có API key cloud trong bundle frontend, browser storage hoặc network request từ browser.
- [ ] Provider không hỗ trợ vision phải trả thông báo rõ ràng.
- [ ] Build, lint và các test liên quan đạt; kết quả được ghi lại.
- [ ] Không deploy production nếu chưa được người dùng cho phép.

---

## 2. Phạm vi

### 2.1 Trong phạm vi

- Provider interface và ProviderFactory.
- Cấu hình provider/model.
- Angular AI service và settings UI.
- Vercel Functions/API backend.
- Quản lý secret bằng environment variables.
- Chuẩn hóa streaming và cancellation.
- Provider fallback và quota/error handling.
- Embedding/RAG compatibility assessment.
- Vision request contract và capability detection.
- Regression tests, build, local/mobile testing.
- Commit, release notes và báo cáo.

### 2.2 Ngoài phạm vi mặc định

- Viết lại toàn bộ AI Chat UI.
- Thay đổi dữ liệu từ vựng/kanji/ngữ pháp.
- Thay đổi Supabase schema hoặc lịch sử hội thoại nếu không cần thiết.
- Migration embedding/vector database ngay trong giai đoạn đầu.
- Production deployment tự động hoặc thủ công khi chưa có phê duyệt.
- Bật dịch vụ trả phí hoặc phát sinh chi phí.

---

## 3. Kiến trúc hiện tại — ghi nhận ban đầu

> Đây là nhận định từ việc đọc một số file trên nhánh master ngày 2026-11-11. Cần kiểm tra toàn bộ repository và xác nhận các file liên quan trước khi sửa.

### 3.1 Luồng hiện tại

```text
Angular AI Chat
  └─ AiService
      ├─ AiSettingsService
      ├─ PromptBuilder / EnhancedPromptBuilder
      ├─ KnowledgeService / SearchEngineService
      ├─ ConversationMemoryService
      └─ ProviderFactory
          ├─ LocalProvider
          └─ CloudProvider (Ollama)
                |
                v
          Vercel /api/chat
                |
                v
          Ollama API
```

### 3.2 File đã đọc ban đầu

| File | Vai trò quan sát được | Ghi chú |
|---|---|---|
| `src/app/ai/services/ai.service.ts` | Điều phối hội thoại, prompt, streaming, abort, memory | Có thể giữ phần lớn logic |
| `src/app/ai/services/ai-settings.service.ts` | Cài đặt provider/model; lưu localStorage | Cần loại bỏ secret khỏi browser settings |
| `src/app/ai/models/prompt.model.ts` | Prompt theo domain và custom hint | Cần regression test |
| `src/app/ai/services/embedding.service.ts` | Gọi embedding qua ProviderFactory | Phải tách quyết định chat và embedding |
| `api/chat.ts` | Vercel Function proxy Ollama generate | Hiện đang Ollama-specific |
| `api/ollama-cloud-models.ts` | Lấy danh sách model Ollama Cloud | Có thể giữ nếu vẫn cần Ollama |
| `src/app/ai/components/ai-settings/ai-settings.component.html` | UI chọn provider và Ollama key | Cần thiết kế lại settings |
| `src/app/ai/providers/ai-provider.interface.ts` | Hợp đồng provider | Cần đọc đầy đủ trước khi thiết kế |
| `src/app/ai/providers/provider-factory.service.ts` | Khởi tạo/chọn provider | Cần đọc đầy đủ |
| `src/app/ai/providers/cloud.provider.ts` | Ollama Cloud implementation | Cần đọc đầy đủ |
| `src/app/ai/providers/local.provider.ts` | Ollama Local implementation | Giữ và regression test |
| `api/embed.ts` | Embedding endpoint | Cần kiểm tra đầy đủ |

### 3.3 Rủi ro đã nhận diện

- Backend `api/chat.ts` hiện gửi request tới `ollama.com/api/generate`, không phải API contract chung.
- Settings hiện có `cloudApiKey` trong cấu hình browser; cách truyền key cloud qua request body cần được thay thế.
- Embedding đang dùng ProviderFactory; thay provider chat có thể vô tình ảnh hưởng vectorization.
- Interface chat hiện được quan sát với trường system/user/model/temperature/topK/stream; chưa thấy hợp đồng đa phương thức cho ảnh.
- Cấu hình `maxDuration` và timeout phải được đối chiếu với giới hạn Vercel plan/runtime thực tế.
- Cần kiểm tra base URL production trong settings vì có thể không trùng với domain deployment đang dùng.

---

## 4. Kiến trúc mục tiêu

```text
Angular AI Chat
  |
  | POST /api/ai/chat (không chứa provider secret)
  v
Vercel AI Gateway nội bộ
  ├─ Request validation
  ├─ Provider/model routing
  ├─ Capability validation (text / vision / tools)
  ├─ Streaming normalization
  ├─ Timeout / cancellation
  ├─ Error normalization
  ├─ Quota-aware fallback policy
  └─ Safe logging (no secrets / no prompt leakage by default)
       |
       ├─ Gemini Adapter  [primary]
       ├─ Groq Adapter    [fallback]
       ├─ Cerebras Adapter [optional, later]
       └─ Ollama Adapter  [local/dev or explicitly configured]
```

### 4.1 Nguyên tắc thiết kế

- Dùng một request/response contract nội bộ độc lập với provider.
- Provider adapter chịu trách nhiệm chuyển đổi contract nội bộ sang API riêng.
- API key chỉ được đọc từ server environment.
- Frontend chỉ nhận provider ID, model ID, capability và trạng thái cấu hình an toàn.
- Tách danh sách model/capability khỏi secret.
- Chuẩn hóa chunk streaming, finish reason và lỗi.
- Có AbortSignal/cancellation end-to-end nếu runtime/provider hỗ trợ.
- Fallback phải có chính sách rõ ràng; không fallback mù quáng với mọi lỗi.
- Không retry vô hạn; giới hạn số lần retry và thời gian.
- Không chuyển provider giữa chừng khi đã stream một phần nội dung, trừ khi có thiết kế resume rõ ràng. Mặc định fallback chỉ trước khi response stream bắt đầu.
- Provider/model có thể có giới hạn context, RPM, TPM, vision và retention khác nhau; lưu metadata để UI/backend kiểm tra.
- Không giả định API tương thích OpenAI đồng nghĩa tương thích hoàn toàn.

### 4.2 Environment variables dự kiến

| Biến | Nơi lưu | Mục đích |
|---|---|---|
| `GEMINI_API_KEY` | Vercel server env | Gemini secret |
| `GROQ_API_KEY` | Vercel server env | Groq secret |
| `CEREBRAS_API_KEY` | Vercel server env, optional | Cerebras secret |
| `OLLAMA_HOST` | Local/server env | Ollama endpoint |
| `AI_DEFAULT_PROVIDER` | Server env | Provider mặc định |
| `AI_FALLBACK_ENABLED` | Server env | Bật/tắt fallback |
| `AI_ALLOWED_MODELS` | Server config/env | Allowlist model (nếu cần) |

Không ghi giá trị thực của các biến trong tài liệu hoặc commit.

---

## 5. Kế hoạch thực hiện từ đầu đến cuối

### Phase 0 — Baseline và kiểm kê đầy đủ

**Mục tiêu:** hiểu chính xác module hiện tại trước khi sửa.

- [ ] Đọc toàn bộ provider interface/factory/local/cloud.
- [ ] Đọc AI settings component TS/HTML/SCSS.
- [ ] Đọc các API routes chat, embed và model listing.
- [ ] Tìm tất cả nơi gọi `ProviderFactory`, `getProvider()`, `configureCloud()`.
- [ ] Tìm tất cả nơi đọc/ghi `cloudApiKey`, `provider`, `model`.
- [ ] Đọc ConversationMemoryService và nguồn lưu lịch sử.
- [ ] Đọc slash command parser/handler.
- [ ] Đọc streaming parser và logic abort.
- [ ] Đọc cấu hình Vercel, package scripts, TypeScript config.
- [ ] Xác định test hiện có và coverage.
- [ ] Xác nhận domain production và các environment hiện có (không đọc/ghi secret ra log).
- [ ] Chụp baseline: build, lint, unit tests hiện tại.

**Deliverables:**
- Bảng file/module/dependency hoàn chỉnh.
- Sơ đồ sequence request hiện tại.
- Danh sách rủi ro và baseline test.
- Danh sách file dự kiến sửa.

**Exit criteria:** hiểu được toàn bộ đường đi từ UI đến provider và backend; mọi thiếu sót được ghi rõ.

### Phase 1 — Chốt API contract và provider capabilities

**Mục tiêu:** thiết kế hợp đồng chung trước khi viết adapter.

- [ ] Định nghĩa ChatRequest: messages, system, model, temperature, max tokens, stream, metadata.
- [ ] Định nghĩa nội dung đa phương thức: text và image references/base64 theo giới hạn an toàn.
- [ ] Định nghĩa ChatChunk/ChatResponse thống nhất.
- [ ] Định nghĩa ChatError: code, provider, retryable, userMessage, requestId.
- [ ] Định nghĩa ProviderCapabilities: text, vision, streaming, embeddings, tools, context limit.
- [ ] Định nghĩa model registry: provider/model/capabilities/limits.
- [ ] Định nghĩa API key resolution chỉ ở server.
- [ ] Định nghĩa chính sách fallback và retry.
- [ ] Định nghĩa cancellation/timeout.
- [ ] Quyết định định dạng stream nội bộ (ví dụ SSE hoặc NDJSON) và tài liệu hóa.
- [ ] Chốt cách giữ tương thích với LocalProvider.

**Deliverables:** tài liệu contract, sơ đồ luồng, quyết định ADR ngắn.

**Exit criteria:** contract được duyệt trước khi triển khai adapter.

### Phase 2 — Backend gateway và bảo mật

**Mục tiêu:** xây lớp API trung gian không phụ thuộc Ollama.

- [ ] Tạo endpoint gateway mới hoặc refactor endpoint hiện tại theo contract đã duyệt.
- [ ] Validate method, content type, body size, model ID và input.
- [ ] Chọn provider dựa trên provider ID an toàn; không nhận API key từ browser.
- [ ] Đọc secret từ server environment.
- [ ] Thêm request ID và logging đã loại bỏ secret.
- [ ] Chuẩn hóa lỗi upstream.
- [ ] Chuẩn hóa timeout và client disconnect.
- [ ] Thêm rate-limit/abuse protection phù hợp với khả năng triển khai.
- [ ] Cấu hình CORS tối thiểu theo domain cần thiết; tránh wildcard nếu không cần.
- [ ] Kiểm tra không log prompt/ảnh nhạy cảm ngoài chính sách được duyệt.
- [ ] Viết test cho validation, missing env, upstream error, timeout và abort.

**Deliverables:** backend gateway hoạt động với mock adapter; không yêu cầu API key thật để test contract.

**Exit criteria:** test bảo mật cơ bản đạt; không có secret trong browser request hoặc response.

### Phase 3 — Gemini adapter (primary)

**Mục tiêu:** thay Ollama Cloud bằng Gemini cho chat văn bản.

- [ ] Xác minh model Gemini hiện có free tier tại ngày tích hợp.
- [ ] Xác minh giới hạn RPM/TPM/RPD, context, streaming, vision và chính sách dữ liệu.
- [ ] Chọn model mặc định theo chất lượng, quota và khả năng tiếng Nhật/tiếng Việt.
- [ ] Tạo adapter chuyển contract nội bộ sang Gemini API.
- [ ] Hỗ trợ system instruction và lịch sử messages.
- [ ] Hỗ trợ streaming và chuẩn hóa chunk.
- [ ] Hỗ trợ abort/timeout theo khả năng SDK/API.
- [ ] Map lỗi auth, quota, safety, invalid request và server error.
- [ ] Kiểm thử tiếng Nhật, tiếng Việt, Kanji, ngữ pháp N3 và prompt có JSON context.
- [ ] Kiểm thử câu trả lời dài và streaming.
- [ ] Không hardcode API key hoặc model ID không còn hợp lệ.

**Deliverables:** Gemini chat adapter + tests + kết quả kiểm thử.

**Exit criteria:** chat văn bản hoạt động qua gateway và không ảnh hưởng logic UI.

### Phase 4 — Groq adapter (fallback)

**Mục tiêu:** thêm lựa chọn dự phòng có free tier.

- [ ] Xác minh model được cấp quyền trên Groq tại thời điểm triển khai.
- [ ] Kiểm tra free-tier limits, context, streaming và vision.
- [ ] Tạo Groq adapter.
- [ ] Chuẩn hóa system/user/messages.
- [ ] Hỗ trợ streaming và abort.
- [ ] Map 401/403/429/5xx.
- [ ] Viết test adapter.
- [ ] Kiểm thử tiếng Nhật/Việt và prompt dài.
- [ ] Kiểm thử khi quota hết.
- [ ] Chỉ bật fallback tự động theo policy đã duyệt.

**Fallback policy mặc định đề xuất:**
- Có thể fallback trước khi stream bắt đầu khi gặp lỗi quota/rate limit hoặc lỗi upstream tạm thời được xác định retryable.
- Không fallback khi API key sai, model không hợp lệ, request validation thất bại hoặc safety refusal.
- Không chuyển provider giữa một stream đang gửi dở.
- Giới hạn một lần fallback trong một request.
- Ghi rõ provider thực tế đã trả lời trong metadata an toàn.

**Deliverables:** Groq adapter + test fallback.

**Exit criteria:** fallback hoạt động theo đúng policy, không tạo vòng lặp hoặc phát sinh request không kiểm soát.

### Phase 5 — Angular provider/settings migration

**Mục tiêu:** giữ UI và luồng hội thoại, đổi cách chọn provider.

- [ ] Mở rộng provider type có định danh rõ ràng.
- [ ] Cập nhật ProviderFactory hoặc chuyển cloud routing về backend.
- [ ] Không đưa secret vào AiSettings.
- [ ] Loại bỏ lưu cloud API key trong localStorage.
- [ ] Thiết kế migration cho dữ liệu settings cũ.
- [ ] Cập nhật Settings UI: provider, model, capability, trạng thái cấu hình.
- [ ] Thêm thông báo provider/model không khả dụng.
- [ ] Giữ tùy chọn Ollama Local.
- [ ] Giữ nguyên prompt/domain context.
- [ ] Giữ slash commands.
- [ ] Giữ conversation history và citations.
- [ ] Giữ busy/error/abort states.
- [ ] Kiểm tra đồng bộ settings nhiều tab nếu đang dùng.
- [ ] Không làm UI hiển thị key đầy đủ hoặc key đã lưu trước đây.

**Deliverables:** Angular UI và services dùng contract mới.

**Exit criteria:** người dùng chat được qua Gemini và Local; không còn gửi cloud secret từ browser.

### Phase 6 — Embeddings, retrieval và dữ liệu cũ

**Mục tiêu:** tránh làm hỏng RAG khi thay chat provider.

- [ ] Xác định provider/model embedding hiện tại.
- [ ] Xác định vector dimension và nơi lưu vector.
- [ ] Kiểm tra cache embedding có persist hay chỉ memory.
- [ ] Kiểm tra dữ liệu vector hiện có có phụ thuộc model cụ thể không.
- [ ] Tách cấu hình embedding khỏi cấu hình chat.
- [ ] Giữ nguyên embedding hiện tại trong migration đầu nếu ổn định.
- [ ] Nếu đổi embedding model: tạo kế hoạch re-embedding riêng, version hóa model/dimension.
- [ ] Không trộn vector từ hai model khác dimension/không cùng không gian.
- [ ] Kiểm thử retrieval relevance và citations.
- [ ] Ghi lại chi phí/quota nếu embedding dùng cloud.

**Deliverables:** quyết định giữ hay migrate embedding; test retrieval.

**Exit criteria:** knowledge search/RAG vẫn trả đúng context và không có vector incompatibility.

### Phase 7 — Vision và nhiều ảnh

**Mục tiêu:** chuẩn bị hỗ trợ người dùng gửi ảnh mà không giả định provider nào cũng đọc được ảnh.

- [ ] Định nghĩa image input contract.
- [ ] Hỗ trợ chọn file, paste clipboard và nhiều ảnh nếu UI hiện tại/phase được duyệt yêu cầu.
- [ ] Preview, xóa ảnh và kiểm tra file type/size.
- [ ] Không gửi tên file như thể đó là nội dung ảnh.
- [ ] Chuyển ảnh thành định dạng được provider hỗ trợ; cân nhắc giới hạn payload.
- [ ] Kiểm tra capability của model trước khi gửi.
- [ ] Hiển thị cảnh báo nếu model không hỗ trợ vision.
- [ ] Kiểm tra Gemini vision.
- [ ] Kiểm tra Groq vision model cụ thể nếu được hỗ trợ; không suy luận từ tên provider.
- [ ] Không fallback ảnh sang model text-only.
- [ ] Kiểm tra mobile layout, paste/selection và nút gửi.
- [ ] Không lưu ảnh vào lịch sử lâu dài nếu chưa có quyết định retention/privacy.

**Deliverables:** vision contract, capability checks, UI tests và test ảnh thực tế.

**Exit criteria:** model vision đọc được nội dung ảnh; model text-only báo lỗi rõ ràng.

### Phase 8 — Quota, observability và kiểm soát chi phí

- [ ] Chuẩn hóa quota/rate-limit errors.
- [ ] Hiển thị thông báo thân thiện khi hết free quota.
- [ ] Không tự động mua credit hoặc bật billing.
- [ ] Theo dõi request count, provider, model, latency, error code và token usage nếu API cung cấp.
- [ ] Không log API key, prompt nhạy cảm hoặc image payload.
- [ ] Tạo dashboard/log summary tối thiểu.
- [ ] Thêm cooldown hoặc circuit breaker cho provider đang rate limited.
- [ ] Có giới hạn retry và fallback.
- [ ] Ghi rõ free-tier limits có thể thay đổi và cần kiểm tra lại định kỳ.

**Deliverables:** tài liệu quota/error matrix và log an toàn.

### Phase 9 — Kiểm thử hồi quy và nghiệm thu

**Functional tests**
- [ ] Chat câu hỏi ngắn/dài.
- [ ] Câu hỏi tiếng Nhật, tiếng Việt, Kanji và ngữ pháp N3.
- [ ] Prompt có knowledge JSON context.
- [ ] Slash commands.
- [ ] Streaming từng token.
- [ ] Stop/cancel.
- [ ] Clear conversation.
- [ ] Conversation history.
- [ ] Citations/answer validation.
- [ ] Local Ollama.
- [ ] Gemini.
- [ ] Groq.
- [ ] Fallback trước khi stream.
- [ ] Vision và model không hỗ trợ vision.
- [ ] Embedding/retrieval.

**Error tests**
- [ ] Thiếu API key.
- [ ] API key không hợp lệ.
- [ ] Model không tồn tại/không được cấp quyền.
- [ ] 429/rate limit.
- [ ] 5xx.
- [ ] Timeout.
- [ ] Network disconnect.
- [ ] Request body quá lớn.
- [ ] Client hủy request.
- [ ] Provider trả response không đúng định dạng.

**UI/device tests**
- [ ] Desktop.
- [ ] iOS Safari/Chrome.
- [ ] Android browser nếu có thiết bị.
- [ ] Không overflow ngang.
- [ ] Nút gửi không bị che.
- [ ] Loading/error states rõ ràng.
- [ ] Settings cũ được migrate an toàn.

**Quality gates**
- [ ] TypeScript/build.
- [ ] Lint.
- [ ] Unit tests.
- [ ] Integration tests.
- [ ] Kiểm tra bundle không chứa secret.
- [ ] Kiểm tra browser storage không có cloud secret.
- [ ] Kiểm tra network request browser không chứa cloud secret.

### Phase 10 — Commit, release và deployment

**Quy tắc commit**
- Commit nhỏ theo phase, không gộp toàn bộ migration thành một commit khó điều tra.
- Mỗi commit có message mô tả mục tiêu và phạm vi.
- Không commit secret hoặc file env chứa secret.
- Sau mỗi commit, cập nhật SHA, file thay đổi, test evidence vào mục 7.
- Nếu test chưa đạt, ghi rõ và không mô tả commit là hoàn tất.

**Quy trình release**
- [ ] Review diff.
- [ ] Chạy toàn bộ quality gates.
- [ ] Xác nhận environment variables đã được cấu hình an toàn (chỉ ghi trạng thái, không ghi giá trị).
- [ ] Kiểm thử preview deployment nếu được duyệt.
- [ ] Báo cáo rủi ro còn lại.
- [ ] Chỉ production deploy sau khi người dùng phê duyệt rõ ràng.
- [ ] Xác minh deployment Ready.
- [ ] Smoke test production.
- [ ] Có rollback plan và ghi lại commit/deployment trước đó.

**Deliverables:** commit ledger, test report, deployment report hoặc ghi rõ “chưa deploy”.

---

## 6. Danh sách file dự kiến thay đổi

> Danh sách này là dự kiến, chưa phải cam kết sửa toàn bộ. Phase 0 phải xác minh đường dẫn và dependency thực tế.

| Khu vực | File/đường dẫn dự kiến | Hành động dự kiến |
|---|---|---|
| Provider | `src/app/ai/providers/ai-provider.interface.ts` | Chuẩn hóa contract/capabilities |
| Provider | `src/app/ai/providers/provider-factory.service.ts` | Cập nhật routing |
| Provider | `src/app/ai/providers/cloud.provider.ts` | Thay hoặc loại bỏ logic key Ollama cloud |
| Provider | `src/app/ai/providers/local.provider.ts` | Giữ, regression test |
| Backend | `api/chat.ts` hoặc `api/ai/chat.ts` | Gateway mới |
| Backend | `api/embed.ts` | Chỉ sửa nếu cần tách embedding |
| Frontend | `src/app/ai/services/ai.service.ts` | Giữ logic, đổi transport nếu cần |
| Settings | `src/app/ai/services/ai-settings.service.ts` | Bỏ secret khỏi browser |
| Settings | AI settings component TS/HTML/SCSS | Provider/model/capability UI |
| Models | `src/app/ai/models/ai-chat.model.ts` | Provider/config types |
| Tests | Các test tương ứng | Unit/integration/regression |
| Docs | File này | Cập nhật sau mọi phase |

Các file mới có thể gồm:
- `api/ai/providers/gemini.adapter.ts`
- `api/ai/providers/groq.adapter.ts`
- `api/ai/providers/cerebras.adapter.ts` (optional)
- `api/ai/contracts.ts`
- `api/ai/provider-registry.ts`
- `api/ai/errors.ts`
- Test fixtures/mocks tương ứng.

Cấu trúc cuối cùng phải theo conventions hiện có của repository; không tạo thêm tầng abstraction không cần thiết.

---

## 7. Engineering log — nhật ký công việc và bằng chứng

> Mỗi lần thực hiện một phase/task, thêm entry mới ở đầu danh sách này. Không ghi đè lịch sử cũ.

### Entry template

```markdown
### YYYY-MM-DD — [Phase/Task] — [PLANNED | IN PROGRESS | BLOCKED | VERIFIED]

**Mục tiêu:**
- ...

**Đã thực hiện:**
- ...

**Files:**
- Added:
- Modified:
- Deleted:

**Quyết định kỹ thuật:**
- ...

**Kiểm thử / bằng chứng:**
- Command:
- Result:
- Evidence/URL:

**Vấn đề và hướng xử lý:**
- ...

**Commit:**
- Branch:
- SHA:
- Message:

**Deployment:**
- Not deployed / Preview / Production
- URL:
- Verified status:

**Còn lại / bước tiếp theo:**
- ...
```

### 2026-11-11 — Initial repository inspection — VERIFIED (PARTIAL)

**Mục tiêu:**
- Kiểm tra cấu trúc AI module để chuẩn bị migration khỏi Ollama Cloud.

**Đã thực hiện:**
- Đọc `api/chat.ts`.
- Đọc `src/app/ai/services/ai.service.ts`.
- Đọc `src/app/ai/services/ai-settings.service.ts`.
- Đọc `src/app/ai/models/prompt.model.ts`.
- Đọc `src/app/ai/services/embedding.service.ts`.
- Đọc một phần AI settings template.
- Đọc `api/ollama-cloud-models.ts`.

**Phát hiện:**
- API chat hiện proxy tới Ollama generate endpoint.
- Settings có provider local/cloud và lưu cấu hình trong localStorage.
- AiService quản lý streaming, abort, message state, context và conversation memory.
- Embedding đang dùng ProviderFactory; phải đánh giá độc lập.
- Request hiện chưa thể hiện image payload trong contract được kiểm tra.

**Giới hạn kiểm tra:**
- Chưa đọc và xác minh toàn bộ provider interface/factory/local/cloud.
- Chưa đọc toàn bộ AI settings component và API embed.
- Chưa chạy build, lint hoặc test.
- Chưa kiểm tra Vercel environment variables.
- Chưa thay đổi source code.

**Commit/deployment:**
- Chưa có commit code.
- Chưa deploy.

**Trạng thái:**
- Đã tạo định hướng migration.
- Phase 0 chưa hoàn tất.

---

## 8. Quyết định kỹ thuật (ADR)

Mỗi quyết định quan trọng cần có mã ADR, ngày, bối cảnh, lựa chọn và hệ quả.

### ADR-001 — Multi-provider gateway

- **Ngày:** 2026-11-11
- **Trạng thái:** PROPOSED
- **Bối cảnh:** backend hiện phụ thuộc Ollama API; cần dùng nhiều cloud provider.
- **Đề xuất:** một gateway nội bộ với adapter riêng cho từng provider.
- **Lợi ích:** frontend không phụ thuộc API contract của nhà cung cấp; secret ở server; dễ thêm/bỏ provider.
- **Rủi ro:** tăng độ phức tạp backend; cần chuẩn hóa stream/cancel/errors.
- **Cần xác nhận:** contract và cấu trúc file sau Phase 0.

### ADR-002 — Provider ưu tiên

- **Ngày:** 2026-11-11
- **Trạng thái:** PROPOSED
- **Đề xuất:** Gemini là cloud provider chính; Groq là fallback; Cerebras để phase tùy chọn; Ollama Local được giữ.
- **Điều kiện:** xác minh free-tier, model access, limits, vision và data policy ngay trước tích hợp.
- **Không cam kết:** free tier không đồng nghĩa unlimited hoặc luôn có sẵn.

### ADR-003 — Secret management

- **Ngày:** 2026-11-11
- **Trạng thái:** PROPOSED
- **Đề xuất:** API key cloud chỉ ở server environment; browser chỉ chọn provider/model.
- **Hệ quả:** cần chuyển settings và migration dữ liệu localStorage; có thể cần người dùng cấu hình environment variables.

### ADR-004 — Embedding migration tách riêng

- **Ngày:** 2026-11-11
- **Trạng thái:** PROPOSED
- **Đề xuất:** không đổi embedding model trong migration chat đầu tiên nếu không bắt buộc.
- **Lý do:** vector dimension/model compatibility có thể ảnh hưởng retrieval và citations.

---

## 9. Ma trận lỗi và xử lý dự kiến

| Tình huống | Hành vi mong muốn | Fallback? |
|---|---|---|
| Thiếu API key | Báo cấu hình server thiếu | Không |
| 401/403 | Báo lỗi xác thực/quyền | Không |
| 400 invalid request | Báo request không hợp lệ | Không |
| 404 model | Báo model không tồn tại/không được cấp quyền | Không mặc định |
| 429 quota/rate limit | Báo giới hạn; cân nhắc provider dự phòng | Có, theo policy |
| 5xx upstream | Báo lỗi dịch vụ tạm thời | Có, trước khi stream |
| Timeout trước stream | Báo timeout hoặc thử provider khác | Có giới hạn |
| Disconnect khi stream | Dừng request và giải phóng trạng thái | Không chuyển giữa stream |
| Model không có vision | Báo model không hỗ trợ ảnh | Không |
| Image quá lớn/định dạng sai | Báo lỗi input trước khi gọi provider | Không |

---

## 10. Báo cáo kết thúc migration

Khi hoàn thành, bổ sung báo cáo theo mẫu:

### Final report — YYYY-MM-DD

**Tóm tắt:**
- Mục tiêu:
- Kết quả:
- Phase hoàn tất:
- Phase chưa hoàn tất:

**Kiến trúc cuối cùng:**
- Provider chính:
- Provider dự phòng:
- Local provider:
- Embedding provider:
- Vision support:

**Thay đổi mã nguồn:**
- File thêm:
- File sửa:
- File xóa:
- Breaking changes:

**Kiểm thử:**
- Build:
- Lint:
- Unit:
- Integration:
- Desktop:
- Mobile:
- Security checks:

**Commit ledger:**
| SHA | Message | Phase | Test status |
|---|---|---|---|

**Deployment:**
- Environment:
- Deployment ID/URL:
- Status:
- Smoke test:
- Rollback point:

**Quota/chi phí:**
- Free tier đã xác minh ngày:
- Model:
- Hạn mức:
- Giới hạn đã biết:
- Billing có bật không:

**Vấn đề còn tồn tại:**
- ...

**Kết luận và khuyến nghị tiếp theo:**
- ...

---

## 11. Trạng thái hiện tại và next action

### Trạng thái

- [x] Người dùng đồng ý hướng migration và yêu cầu tạo kế hoạch có lưu vết.
- [x] Đã kiểm tra một phần cấu trúc AI module.
- [x] Đã xác định định hướng Gemini primary + Groq fallback + Ollama Local.
- [ ] Hoàn tất Phase 0: kiểm kê toàn bộ code và baseline tests.
- [ ] Hoàn tất Phase 1: chốt contract và ADR.
- [ ] Bắt đầu backend gateway.
- [ ] Tích hợp Gemini.
- [ ] Tích hợp Groq.
- [ ] Migration Angular settings/provider.
- [ ] Kiểm thử embedding/RAG.
- [ ] Kiểm thử vision.
- [ ] Regression và nghiệm thu.
- [ ] Báo cáo commit/release.
- [ ] Production deployment — chỉ khi có phê duyệt riêng.

### Việc tiếp theo được phép thực hiện

**Tiếp tục Phase 0 בלבד:** đọc phần provider còn thiếu, AI settings component, API embed, conversation memory, slash command, streaming/cancellation và test scripts; chạy baseline build/test nếu môi trường cho phép; cập nhật kết quả vào Engineering log.

**Chưa được phép ở bước này:** sửa source code, thêm API key, thay đổi Supabase, bật billing hoặc deploy production. Cần trình bày kết quả Phase 0 và danh sách file thay đổi cụ thể để người dùng duyệt trước khi bắt đầu implementation.


### 2026-11-11 — Phase 0 baseline — IN PROGRESS

**Source inspection:** reviewed provider interface/factory, local and cloud providers, AI settings service/model/component, chat and embedding API routes, embedding and knowledge services, conversation memory/Supabase persistence, assistant component, slash-command service/model, NDJSON abortable stream parser, package.json, vercel.json and existing smoke-test script.

**Confirmed findings:**
- Cloud credential is part of AiSettings, persisted in localStorage and sent by the browser to both chat and embedding endpoints.
- Chat endpoint logs a masked fragment of the credential; remove all credential logging in the future implementation.
- Chat and embedding currently share the active ProviderFactory; separate their provider configuration before migration.
- Existing chat contract is text-only; no image or capability contract was found.
- Existing smoke tests are Ollama-specific and must be deliberately migrated.
- Slash commands and Supabase conversation history are separate application concerns and should be preserved.
- Wildcard CORS exists in API code and vercel.json; validate required web/Capacitor origins before tightening.

**Local baseline (host dung-Vostro-14-5410):**
- Local branch master HEAD: `3168a5f5ca8c0c5c821c1ace0b2b2dce1c222136`; working tree clean.
- Cached tracking metadata says local master is ahead 2 / behind 15 relative to cached origin/master. This is not yet refreshed; do not pull, reset or rebase until local-only commits are reviewed.
- Node v24.21.0; npm 11.19.0.
- `npm run build`: PASS when run with elevated permissions. Browser/server bundles built; 15 routes prerendered. Warnings: CommonJS optimization bailout for whatwg-url and @supabase/node-fetch; Node punycode deprecation.
- `npm test -- --watch=false --browsers=ChromeHeadless`: PASS when run as app user; 1 spec passed. Root-run attempt failed because Chrome blocks root without --no-sandbox.
- First user-level build attempt compiled bundles but failed deleting a dist artifact because dist was owned by the SentinelX service account. This is a local permissions issue; do not change ownership without review.
- No provider keys accessed, no billing enabled, no source files changed, no deployment.

**Important source-snapshot discrepancy:** GitHub master received the documentation commit created in this session, while local working copy is at an older/different HEAD. Baseline build/test results apply to local HEAD, and source review applies to GitHub master. Reconcile these snapshots before code changes.

**Next:** refresh remote refs safely, inspect unpushed/local-only commits, reconcile local and remote source snapshots, complete remaining call-site inventory and expand tests. Phase 0 is not complete yet.


### 2026-11-11 — Phase 0 completed — VERIFIED (inspection only)

**Remote synchronization audit:**
- A fresh, separate audit clone was created under `/tmp/jva-audit-DtGT1s/repo` and checked out at the exact GitHub master HEAD `f25faa3a912245709369859273a8e66c1d4c0eac`. The user's working repository was not reset, rebased, pulled or modified.
- Fresh fetch in the user's working repository failed because some Git object directories/files under `.git/objects` are owned by the SentinelX service account and not writable by user `dung`. This is a local Git permission inconsistency.
- Cached local-only commits are exactly two vocabulary commits: lesson 6 and lesson 7. Their file blob SHAs are identical to the corresponding files on current remote master. Thus their content is already present upstream; they are duplicate commits, not unique source changes.
- Remote master has 15 commits not present in the old local branch cache, including N6 lessons 6–20, the adverb module, mobile vocabulary fixes and this migration document. The fresh audit clone is now the reliable baseline snapshot.
- Do not reset/rebase the user's local working copy as part of AI migration. Use the fresh remote snapshot or a separately created migration branch/worktree after agreeing on a safe workflow.

**Fresh remote baseline validation (exact commit `f25faa3a912245709369859273a8e66c1d4c0eac`):**
- Node v24.21.0 / npm 11.19.0.
- `npm ci`: PASS; installed 1,109 packages. npm reported 72 dependency vulnerabilities (1 low, 33 moderate, 33 high, 5 critical). This requires a separate dependency triage; do not run `npm audit fix --force` as part of this migration without review.
- `npm run build`: PASS; browser and server bundles generated; 15 static routes prerendered. Existing CommonJS optimization warnings for `whatwg-url` and `@supabase/node-fetch`; Node punycode deprecation warning.
- `npm test -- --watch=false --browsers=ChromeHeadless`: FAIL; only one spec executed. `AdverbComponent should create` fails with `NullInjectorError: No provider for HttpClient!`. This is a pre-existing test setup defect on current remote master. The earlier PASS result came from the stale local branch and must not be used as current-master baseline.
- Current remote has only one `.spec.ts` file found under `src`; AI module has no dedicated unit tests in the inspected tree.
- npm install emitted deprecated-package and install-script approval warnings; record for dependency maintenance, not a reason to change package versions during AI migration.

**Phase 0 deliverable — verified file-level implementation scope:**

Backend:
- Add a provider-neutral AI gateway module (contract, registry, adapters, normalized errors/stream).
- Refactor `api/chat.ts` to route only to server-configured providers and never accept/log a provider API key from request body.
- Keep `api/embed.ts` separate from chat provider selection; remove browser-supplied cloud secret. Do not change embedding model/vector dimensions in first migration.
- Retire or retain `api/ollama-cloud-models.ts` only for an explicitly supported Ollama Cloud option; it is not needed for Gemini/Groq model registry.
- Revisit `vercel.json` CORS only after confirming browser and Capacitor origins.
- Add mock-based tests for adapters, validation, stream, abort, errors and fallback.

Angular:
- Update `src/app/ai/models/ai-chat.model.ts` to represent provider/model/capabilities without a cloud API key.
- Update `src/app/ai/providers/ai-provider.interface.ts` and `provider-factory.service.ts` for provider-neutral routing or backend gateway transport.
- Replace/refactor `cloud.provider.ts` as the remote gateway provider; preserve `local.provider.ts` direct local Ollama and local proxy fallback behavior.
- Update `ai-settings.service.ts` to migrate old `ai_settings_v2` safely and strip `cloudApiKey` from persisted settings.
- Update AI settings component TS/HTML/CSS to show Gemini/Groq/Local, model availability, capabilities and safe configuration status; do not expose secrets.
- Update `ai.service.ts` only as needed to preserve prompts, history, streaming, cancellation and error state.
- Update `embedding.service.ts` to use an independent embedding provider/configuration rather than the active chat provider.
- Keep `knowledge.service.ts`, prompt builders, `response-validator.util.ts`, conversation memory, Supabase history and slash-command services functionally unchanged unless contract changes require small adaptations.
- Update `stream-event.model.ts` and `abortable-stream.util.ts` if the normalized gateway stream requires it.
- Update `scripts/test-fixes.mjs` because current assertions require Ollama cloud key behavior.
- Add AI-specific unit/integration tests; fix the existing AdverbComponent HttpClient test setup as a separate baseline repair or record it as an existing blocker.

**Proposed implementation order after approval:**
1. Create/choose a clean migration branch from exact current master. Do not reuse stale local master.
2. Add AI gateway contracts, fake adapters and automated tests (no real API keys).
3. Add Gemini adapter and server environment key lookup.
4. Add Groq adapter and explicit pre-stream fallback policy.
5. Migrate Angular settings/provider transport; remove browser secret persistence and requests.
6. Separate embedding config while preserving current embedding model.
7. Add vision capability contract as a separately testable scope; only enable models confirmed to accept image input.
8. Regression, security checks, local/mobile test and report.
9. Commit in small phase-specific commits. Preview/production deployment requires explicit user approval; billing must remain disabled.

**Phase 0 exit decision:**
- [x] Existing architecture and relevant code paths mapped.
- [x] Main security risks and coupling identified.
- [x] Current remote master build/test baseline recorded.
- [x] Local/remote divergence investigated without destructive changes.
- [x] Proposed implementation file scope and sequence documented.
- [ ] Implementation authorization: awaiting explicit go-ahead for source-code changes.

**No source files changed during Phase 0. No provider keys configured. No billing enabled. No deployment performed.**


### 2026-11-11 — Phase 1 / Step 1: provider-neutral contract — IMPLEMENTED

**Branch:** `ai-provider-migration` (created from current GitHub master commit `f2f2d92b486056c62a33040442051508eef37413`). Local `master` was not modified.

**Files added:**
- `api/_lib/ai/contracts.ts`: provider identifiers (`gemini | groq | local`), chat request, image input, normalized gateway error codes, stream events, model capabilities, provider adapter interface, success/error response contracts, runtime request validator.
- `api/_lib/ai/contracts.test.ts`: Node built-in tests for supported providers, malformed requests, bounded settings, MIME/image size/count checks.

**Validation rules currently encoded:**
- Request must be an object and provider must be one of the three supported IDs.
- Model name is required and limited to 160 chars.
- Prompt is required and limited to 40,000 chars; system prompt limited to 12,000 chars.
- Temperature 0–2; topK integer 1–100; stream boolean.
- Up to 4 images, JPEG/PNG/WebP/GIF only, each base64 payload limited to 8,000,000 chars.
- These image fields are a reserved contract only. No provider currently accepts/processes image data and no image is sent upstream in this step.

**Tests on branch HEAD `2901c2252c6159026768896683cb900211981ae3`:**
- `node --experimental-strip-types --test api/_lib/ai/contracts.test.ts`: PASS, 5/5 tests.
- `npm run build`: PASS, 15 routes prerendered.
- Existing CommonJS optimization warnings and Node punycode deprecation remain.
- Existing Angular unit-test baseline failure remains unmodified: AdverbComponent missing HttpClient provider.

**Safety / scope:**
- No provider SDK added; no API keys requested or stored; no billing enabled.
- No chat, embedding, settings UI or existing provider code changed yet.
- No production deployment.
- Tests use synthetic data only.

**Next implementation step:**
- Add server-side provider registry and a Gemini adapter behind the contract, using `GEMINI_API_KEY` from server environment only.
- Keep adapter unit tests mocked; no real API call until user explicitly supplies/configures credentials.
- Before fallback implementation, define which normalized failures are retryable and ensure fallback only happens before any stream token has been emitted.


### 2026-11-11 — Phase 1 / Step 2: Gemini server adapter — IMPLEMENTED

**Files added/changed:**
- `api/_lib/ai/gemini.adapter.ts`: Gemini REST streaming adapter. Reads `GEMINI_API_KEY` only from server environment by default; injectable fetch/timeout for deterministic tests; maps HTTP 429 to retryable rate limit with bounded Retry-After; maps 5xx/network/timeout to retryable provider unavailable/timeout; maps other 4xx to non-retryable provider rejection; consumes SSE text events; propagates AbortSignal; does not log keys or include key in public errors.
- `api/_lib/ai/gemini.adapter.test.ts`: mocked tests for missing key, SSE token streaming, request payload, rate limit mapping, 5xx mapping, vision-disabled behavior and capabilities.

**Important implementation decision:**
- Gemini model capabilities currently report text=true, streaming=true, vision=false. Although the request contract has a reserved images property, the adapter rejects image requests before any network call. Vision must not be shown as supported until full end-to-end support and model allowlist are implemented.
- Uses Gemini REST endpoint `v1beta/models/{model}:streamGenerateContent?alt=sse`; key is server-side only. No real API request made.
- Does not yet route production `/api/chat` traffic; current Ollama chat endpoint remains unchanged until gateway routing step.

**Validation on branch HEAD `dbe7589e0c3d24952d723b2004c61c0d29e520fe`:**
- `node --experimental-strip-types --test api/_lib/ai/contracts.test.ts api/_lib/ai/gemini.adapter.test.ts`: PASS, 11/11 tests.
- `npm run build`: PASS, browser/server bundles and 15 prerendered routes.
- First adapter test run exposed Node v24 strip-only TypeScript incompatibility with constructor parameter properties. Refactored constructor to explicit fields/assignments and reran; all 11 tests pass.
- Build warnings unchanged: CommonJS `whatwg-url` / `@supabase/node-fetch` and Node punycode deprecation.
- Node emits MODULE_TYPELESS_PACKAGE_JSON warning when executing TS tests with `--experimental-strip-types`; this is test-runner mode warning, not test failure.

**Cost/security:**
- No real key used; mock key only.
- No live provider request, billing, or deployment.
- Existing /api/chat still uses old Ollama code and still has browser-supplied key handling; security issue is not fixed until the gateway route replaces it. Do not describe migration as secure/complete yet.

**Next:**
1. Add provider registry and normalized stream orchestration.
2. Add mock-tested Groq adapter.
3. Add gateway route and only then migrate browser transport; remove legacy browser-supplied key flow in the same controlled cutover.
4. Ensure fallback happens only before the first emitted token and never on auth/invalid-request/capability errors.


### 2026-11-11 — Phase 1 / Step 3: Groq server adapter — IMPLEMENTED

**Files added:**
- `api/_lib/ai/groq.adapter.ts`: Groq Chat Completions adapter using server-only `GROQ_API_KEY`; OpenAI-compatible JSON request; SSE parsing; system/user messages; temperature/top_k; AbortSignal and timeout; normalized error mapping.
- `api/_lib/ai/groq.adapter.test.ts`: mocked tests for missing key/no upstream call, streaming, server bearer auth, rate limit/retry-after, 5xx, 401, unsupported images and capability declaration.

**Policy and implementation notes:**
- Groq vision capability remains false. Any image request is rejected before network access.
- API key is passed as server Authorization header; never sent in JSON body or public error. No logging added.
- 429 and 5xx are retryable; 401 and other 4xx are non-retryable.
- Retry-After is bounded to one hour.
- Adapter does not yet route production traffic; /api/chat remains unchanged.
- No real Groq request or billing activity.

**Validation on branch HEAD `6beeae5e92e9168f9614fed55a03aeabb60b6cf1`:**
- `node --experimental-strip-types --test api/_lib/ai/contracts.test.ts api/_lib/ai/gemini.adapter.test.ts api/_lib/ai/groq.adapter.test.ts`: PASS, 17/17.
- `npm run build`: PASS, 15 prerendered routes.
- Existing CommonJS optimization warnings for `whatwg-url` / `@supabase/node-fetch` and Node `punycode` deprecation remain.
- Test runner prints Node MODULE_TYPELESS_PACKAGE_JSON warning because TS tests use `--experimental-strip-types`; no failures.

**Next step:**
- Add a provider registry and deterministic fallback orchestrator. Fallback is allowed only before the first token is emitted and only for retryable errors (rate limit, timeout, provider unavailable); never for missing key, authentication/provider rejection, invalid request, unsupported capability, client abort, or after partial output.
- Then add a gateway route with server-side credentials and normalized streaming. Do not switch Angular transport until route tests and compatibility are complete.


### 2026-11-11 — Phase 1 / Step 4: provider registry and fallback orchestrator — IMPLEMENTED

**Files added:**
- `api/_lib/ai/provider-registry.ts`: static Gemini/Groq registry and async stream orchestration.
- `api/_lib/ai/provider-registry.test.ts`: safety tests for fallback conditions.

**Fallback policy implemented:**
- The selected provider is attempted first.
- Explicit ordered fallback candidates only; no implicit/unbounded provider switching.
- Fallback eligible only for normalized `rate_limited`, `provider_unavailable`, and `upstream_timeout`.
- Fallback is blocked after the first token, after caller abort, or for provider missing/configuration, auth/provider rejection, invalid request and unsupported capability.
- A fallback adapter must support the requested capabilities.
- If the selected primary adapter is missing, return a configuration error; do not silently switch to another provider.
- If a configured fallback is missing or lacks capability, skip it and return the last useful error if no candidate succeeds.
- No automatic fallback from a selected local provider; local Ollama remains a separate path to wire later.

**Files added earlier in Phase 1 (current gateway package):**
- `api/_lib/ai/contracts.ts`
- `api/_lib/ai/contracts.test.ts`
- `api/_lib/ai/gemini.adapter.ts`
- `api/_lib/ai/gemini.adapter.test.ts`
- `api/_lib/ai/groq.adapter.ts`
- `api/_lib/ai/groq.adapter.test.ts`

**Validation on branch HEAD `45259766cc59ab1e3cfbf285fc68c6af43800320`:**
- `node --experimental-strip-types --test api/_lib/ai/contracts.test.ts api/_lib/ai/gemini.adapter.test.ts api/_lib/ai/groq.adapter.test.ts api/_lib/ai/provider-registry.test.ts`: PASS, 24/24 tests.
- `npm run build`: PASS, 15 prerendered routes.
- Existing warnings remain: CommonJS `whatwg-url` and `@supabase/node-fetch`; Node `punycode` deprecation; Node test runner MODULE_TYPELESS_PACKAGE_JSON warning.
- One test was corrected to abort before execution (rather than abort after completion); rerun passed.

**Security and release status:**
- No real API key or external provider request.
- No /api/chat routing cutover yet.
- No frontend changes.
- No embedding changes.
- No billing or production deployment.

**Next step (Phase 1 / Step 5):**
- Implement and test a provider-neutral Vercel streaming route (or refactor `api/chat.ts`) that validates body, applies selected provider/fallback policy, reads server environment keys, streams a stable NDJSON/SSE contract, handles request disconnect/abort, and never accepts API keys from browser.
- Before replacing the current endpoint, verify current Angular CloudProvider NDJSON parser and local provider route contract to preserve compatibility. Keep embedding API separate.


### 2026-11-11 — Phase 1 / Step 5: isolated Vercel cloud gateway — IMPLEMENTED (not yet cut over)

**New endpoint:**
- `api/ai-chat.ts` — POST `/api/ai-chat`, dedicated cloud endpoint. Existing `api/chat.ts`, `api/embed.ts`, Angular providers and settings UI are unchanged.
- Validates incoming body through `validateAiChatRequest`.
- Instantiates Gemini/Groq adapters server-side; credentials are read from `GEMINI_API_KEY` and `GROQ_API_KEY`.
- Optional reciprocal fallback controlled by server env `AI_CLOUD_FALLBACK_ENABLED=true`; disabled by default.
- NDJSON compatibility events: `{"response":"token"}\n`, `{"done":true}\n`, or normalized `{"error":"...","code":"...","retryable":false}\n`.
- `stream:false` returns JSON `{response}`.
- Abort propagation from client disconnect / response close to adapter AbortSignal.
- Local provider is intentionally rejected on this new endpoint; current Ollama Local stays on legacy `/api/chat` until a separately tested routing strategy is implemented.
- Embedding remains on legacy `/api/embed`, unchanged.

**Security adjustment:**
- Gemini API key is sent to Google using the `x-goog-api-key` request header (not URL query string), avoiding credential exposure in URL logs. Adapter test updated to assert this.
- Browser is not expected to submit provider API keys to `/api/ai-chat`.
- CORS is currently wildcard for existing mobile-client compatibility. Before public release, restrict to explicit app origins and confirm mobile origin behavior.
- No real credentials or external provider calls.

**Validation on branch HEAD `eba58bb2573fbe44cdbab90f906dd873f4d6e5a4`:**
- Contract + Gemini + Groq + fallback suite: PASS, 24/24.
- `npm run build`: PASS, 15 prerendered routes.
- Existing Node MODULE_TYPELESS_PACKAGE_JSON and punycode deprecation warnings; Angular CommonJS warnings for `whatwg-url` / `@supabase/node-fetch`.
- No dedicated handler integration tests for `api/ai-chat.ts` have been added yet. Build validates TypeScript integration, not runtime Vercel behavior.

**Not yet done / release blockers:**
- No frontend transport change; Angular CloudProvider still calls legacy `/api/chat` with browser-stored Ollama Cloud API key.
- No settings UI/provider/model selection migration.
- No runtime request against Vercel; no API key configured or real provider smoke test.
- No security hardening of wildcard CORS / request rate limits / authentication.
- No Vercel deployment, no production changes.
- Legacy Ollama embedding API and local provider are untouched.

**Next:**
1. Add handler-level tests for method validation, malformed request, missing server keys, stream and non-stream NDJSON/JSON, client abort, and provider errors. Consider injecting registry/adapter factory for deterministic tests.
2. Audit Vercel function runtime support for Node built-ins and stream lifecycle.
3. Then migrate Angular CloudProvider to call `/api/ai-chat` without browser API key, while retaining separate Ollama Local and embedding behavior. Settings UI must distinguish server-configured cloud providers from user-supplied local endpoint.


### 2026-11-11 — Phase 1 / Step 6: Vercel gateway handler tests — IMPLEMENTED

**Files changed/added:**
- `api/ai-chat.ts`: refactored handler into `createAiChatHandler(dependencies)` with injectable registry factory and environment map; default export still instantiates the production handler. This makes HTTP behavior testable without live provider calls.
- `api/ai-chat.test.ts`: 8 handler-level tests using mocked Vercel request/response and fake adapters.

**Coverage:**
- OPTIONS preflight and method rejection.
- Invalid body rejected before provider invocation.
- Missing server-side provider key returns safe 503.
- Streaming NDJSON token and done frames.
- Non-streaming JSON response.
- Provider 429 mapping to HTTP 429.
- In-band NDJSON error after partial output.
- Local provider rejected on the cloud-only endpoint.

**Test correction:**
- First run: 31/32 passed. The in-band error test expected no provider field, while the gateway correctly included `provider: gemini`. Updated the assertion to match the stable public error envelope.
- Final run: 32/32 passed.

**Validation on branch HEAD `153c8e9aab69cd2cc5d88464f1709416a24b388f`:**
- `node --experimental-strip-types --test api/ai-chat.test.ts api/_lib/ai/contracts.test.ts api/_lib/ai/gemini.adapter.test.ts api/_lib/ai/groq.adapter.test.ts api/_lib/ai/provider-registry.test.ts`: PASS, 32/32.
- `npm run build`: PASS, 15 prerendered routes.
- Existing warnings: Node MODULE_TYPELESS_PACKAGE_JSON in TS test mode, punycode deprecation, CommonJS optimization warnings for whatwg-url / @supabase/node-fetch.

**Remaining runtime/release checks:**
- Tests are mocked; no actual Vercel invocation or live provider request.
- No authentication, request rate limiting, per-user quota, or restrictive CORS yet. Wildcard CORS is still present and must be restricted/justified before public rollout.
- No request size enforcement at the Vercel platform boundary beyond field-level validation; verify body size limits.
- Verify Vercel Hobby/Pro maxDuration and streaming runtime behavior against the actual project plan.
- Need ensure request close/disconnect behavior works with actual Vercel Node request/response objects.
- Existing legacy `/api/chat` still accepts browser-provided Ollama Cloud API keys; this migration has not cut over or fixed that legacy behavior.

**Next step:**
- Audit and implement Angular transport cutover safely: inspect CloudProvider, provider interface/factory, AiSettingsService, settings UI and any consumers. Keep Ollama Local and embeddings separate. Remove browser-side Ollama Cloud credential use only in the same migration step that switches the UI to server-configured Gemini/Groq. Add Angular service/provider tests and local manual smoke-test checklist. Do not deploy.


### 2026-11-11 — Phase 2 / Step 1: Angular cloud provider/settings migration — IMPLEMENTED, LOCAL VALIDATION ONLY

**Angular files changed:**
- `src/app/ai/providers/cloud.provider.ts`: cloud chat now calls `POST /api/ai-chat`; sends provider/model/system/prompt/temperature/topK/stream only; no browser credential.
- `src/app/ai/models/ai-chat.model.ts`: adds `AiCloudProvider = 'gemini' | 'groq'`, adds `cloudProvider` setting, marks legacy `cloudApiKey` optional/deprecated for migration cleanup.
- `src/app/ai/providers/provider-factory.service.ts`: removes API-key configuration method.
- `src/app/ai/services/ai.service.ts`: no longer passes cloud API key into provider factory.
- `src/app/ai/services/ai-settings.service.ts`: sanitizes settings, removes legacy `cloudApiKey` from memory and persisted JSON, rewrites legacy `ai_settings_v2` on load.
- `src/app/ai/components/ai-settings/ai-settings.component.ts` and `.html`: replaces Ollama Cloud/key/model catalog UI with Gemini/Groq selector, model field, server-side key instructions, and gateway test connection.
- `src/app/ai/services/embedding.service.ts`: embeddings explicitly use local provider, preserving separate legacy `/api/embed` behavior regardless of selected chat provider.

**Compatibility decisions:**
- Ollama Local chat and embedding paths remain unchanged.
- Gemini/Groq keys are never entered into browser settings or sent by Angular.
- Old `cloudApiKey` is removed when legacy settings load and sanitized back to localStorage.
- Legacy `/api/chat` endpoint is not deleted or modified.
- Cloud model defaults: Gemini `gemini-2.5-flash`; Groq `llama-3.3-70b-versatile`. Verify availability against provider accounts before live use.

**Validation:**
- First build exposed a malformed newline insertion in settings-service sanitizer; corrected immediately.
- Final `npm run build`: PASS, 15 prerendered routes.
- AI gateway suite: PASS, 32/32.
- `npm test -- --watch=false`: NOT RUN TO COMPLETION — Karma could not launch Chrome because host has no X server / DISPLAY. Angular browser tests remain outstanding.
- Existing warnings: Node punycode deprecation; Angular CommonJS warnings for `whatwg-url` / `@supabase/node-fetch`; Node TS test MODULE_TYPELESS_PACKAGE_JSON warnings.

**Current branch head at validation:** `1615cc6c31b3f897d5dedef011127fde2ed2796d`.

**Not yet done / release blockers:**
- No real Gemini/Groq key configured; no live request.
- No deployed Vercel runtime smoke test.
- No restrictive CORS, auth, per-user rate limiting or quota protection on `/api/ai-chat`.
- No browser UI test run due missing display.
- No frontend tests yet for cloud settings migration or key sanitization.
- Need verify actual model identifiers and provider account access.
- Need verify mobile/Capacitor base URL points to the correct deployment; existing constant may be stale.
- No deployment, production cutover, merge to master, or production environment changes.

**Next steps:**
1. Add unit tests for AiSettingsService legacy-key sanitization and CloudProvider request shape (prove no credential is sent).
2. Review model selection and mobile base URL; add a documented local manual smoke test.
3. Harden gateway CORS, authentication/abuse controls, body limits, and request lifecycle; verify actual Vercel runtime limits.
4. Configure API keys only after user sets them in Vercel environment settings; perform controlled smoke test.
5. Keep deployment blocked until all checks and user approval.


### 2026-11-12 — Phase 2 / Step 2: Embedding isolation, mobile API origin, and credential regression tests

**Audit findings and fixes:**
1. Found `EmbeddingService.getEmbedding()` used `providerFactory.get('local')`, but batch method `getEmbeddings()` still used `getProvider()` (the active chat provider). Fixed both methods to explicitly use Local Ollama so choosing Gemini/Groq cannot redirect embedding/vectorization.
2. `AiService` had hardcoded local endpoint `http://localhost:11434` instead of the user's configured `localEndpoint`. It now respects saved `localEndpoint`, with localhost fallback.
3. `AiSettingsService.baseUrl()` used stale placeholder `https://japanese-vocab-app.vercel.app` for Capacitor/file/localhost contexts. Updated to the known project deployment origin `https://japanese-vocab-app-dungcts.vercel.app`. Must re-verify against Vercel project Domains before a release; no production request was made.

**Regression tests added:**
- `src/app/ai/services/ai-settings.service.spec.ts`: verifies legacy `cloudApiKey` is removed from memory and localStorage on migration, and cannot be reintroduced through update.
- `src/app/ai/providers/cloud.provider.spec.ts`: verifies cloud browser request targets `/api/ai-chat`, includes provider/model/prompt/system, and does not include `apiKey` or `cloudApiKey`.

**Validation on branch HEAD `061d10d264df97b4f22efe2587fa794e9c4f98b8`:**
- `npm run build`: PASS; 15 prerendered routes.
- AI gateway Node tests: 32/32 PASS.
- Focused Angular AI browser tests (`npx ng test --watch=false --browsers=ChromeHeadless --include="src/app/ai/**/*.spec.ts"`): 3/3 PASS.
- Full Angular browser test suite: 3/4 PASS, 1 unrelated existing `AdverbComponent should create` failure because its test module does not provide `HttpClient`. This is not caused by the AI changes; it remains an existing suite issue and should be fixed separately.
- Initial focused test compile found Jasmine matcher `toHaveProperty` unavailable in this project's Jasmine type setup; replaced with `Object.prototype.hasOwnProperty.call` and reran successfully.

**Important remaining caveats:**
- The mobile origin was updated to the previously recorded deployed domain, but Vercel Domains still needs a current authoritative verification before release.
- No real Gemini/Groq credentials or live calls; no deployed runtime smoke test.
- CORS is still wildcard; authentication, abuse/rate limiting, quota protection and request lifecycle hardening remain incomplete.
- No merge to master and no deployment.

**Next:** inspect Vercel project configuration/domain and function runtime limits; design authentication/abuse control compatible with the app's current user/session model; tighten CORS; add request body/timeout safeguards and runtime smoke tests. Then prepare user-facing local test steps. Do not deploy until explicit approval.
