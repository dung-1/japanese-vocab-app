# AI_IMPLEMENTATION_PLAN

> Kế hoạch triển khai chi tiết tích hợp AI Assistant vào **JapaneseVocabApp**
> Đường dẫn dự án: `H:\Scripts\japanese-vocab-app`
> Cơ sở: báo cáo `AI_ARCHITECTURE_REVIEW.md` (đã đọc)
> Ngày lập: 2026-06-27
> Phạm vi: CHỈ LẬP KẾ HOẠCH – KHÔNG CODE – KHÔNG SỬA SOURCE

---

## Mục lục
1. [Mục tiêu](#1-mục-tiêu)
2. [Kiến trúc cuối cùng](#2-kiến-trúc-cuối-cùng)
3. [Danh sách file cần tạo](#3-danh-sách-file-cần-tạo)
4. [Danh sách file cần sửa](#4-danh-sách-file-cần-sửa)
5. [Phân chia phase](#5-phân-chia-phase)
6. [Checklist triển khai](#6-checklist-triển-khai)
7. [Chiến lược testing](#7-chiến-lược-testing)
8. [Đánh giá rủi ro](#8-đánh-giá-rủi-ro)

---

## 1. Mục tiêu

### 1.1. Mục tiêu kinh doanh
Xây dựng **AI Assistant** nhúng trong JapaneseVocabApp giúp người học:
- **Hỏi đáp Kanji**: giải thích nghĩa, âm Hán Việt, on'yomi, kun'yomi, ví dụ từ vựng chứa kanji.
- **Hỏi đáp Từ vựng**: tra nghĩa hiragana/romaji, gợi ý câu ví dụ.
- **Hỏi đáp Bộ thủ**: ý nghĩa bộ thủ, kanji nào chứa bộ thủ đó, cách ghi nhớ.
- **Hỏi đáp Ngữ pháp**: cấu trúc ngữ pháp thường gặp N2-N4, ví dụ minh hoạ (dựa trên kiến thức model + cảnh báo không có trong dữ liệu).

### 1.2. Mục tiêu kỹ thuật (dựa trên phân tích source thực tế)
1. Tận dụng dữ liệu JSON đã có (~1.1 MB) trong `src/assets/` làm nguồn RAG.
2. **Không Backend** – 100% frontend, chỉ thêm endpoint proxy nhỏ trong SSR Express (`src/server.ts` đã có).
3. Dùng **Angular Signals** (đã có pattern trong `MusicPlayerService`) làm state reactive.
4. Dùng **NgModule pattern** (đã có – không dùng standalone components) để nhất quán.
5. Tương thích **SSR + Prerender + PWA** hiện có (kiểm tra mọi thay đổi không phá render-mode).
6. **RAG-first**, validate chống bịa bằng cách so khớp token output với dữ liệu JSON đã load.
7. Streaming phản hồi qua **fetch + ReadableStream + NDJSON** (tránh thêm thư viện).
8. Hỗ trợ **Ollama** local (Qwen2.5 7B / Llama3.1 8B / Mistral). Ghi chú: model `minimax-m3:cloud` không có sẵn trên Ollama → cần user pull model tương đương trước.

### 1.3. Tiêu chí thành công đo lường được
- 4/4 domain (kanji / vocab / radical / grammar) trả lời được.
- ≥ 80% câu hỏi về kanji/vocab/radical có citation trỏ đúng file JSON cụ thể.
- Câu trả lời ngữ pháp có disclaimer "Không có trong dữ liệu JSON".
- Build production pass (`ng build`), test pass (`ng test`).
- Initial bundle tăng ≤ 50 KB (lazy load AI module).

---

## 2. Kiến trúc cuối cùng

### 2.1. Sơ đồ tổng thể

```
┌──────────────────────────────────────────────────────────────────┐
│                        BROWSER (Angular 19)                       │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  HomeComponent (home.component.ts)                         │   │
│  │  └─ Thêm menu card thứ 6: "🤖 Trợ lý AI" → /ai-assistant │   │
│  └────────────────────────────────────────────────────────────┘   │
│                              │                                    │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  AiAssistantComponent (lazy load từ app-routing)           │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │ AiChatBubbleComponent × N (history)                  │  │   │
│  │  │ AiSuggestionChipsComponent (gợi ý câu hỏi)           │  │   │
│  │  │ <input> + <button> gửi                                │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────┬──────────────────────────────────┘   │
│                            │ submit(question)                    │
│                            ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  AiService (orchestrator)                                  │   │
│  │  1. detectDomain(question)                                 │   │
│  │  2. searchContext(domain, question, topK=5)                │   │
│  │  3. buildPrompt(domain, context, question)                 │   │
│  │  4. streamChat(prompt) → tokens                            │   │
│  │  5. validate(response)                                     │   │
│  └──────────────┬─────────────────┬──────────────────┬─────────┘   │
│                 │                 │                  │             │
│                 ▼                 ▼                  ▼             │
│  ┌────────────────────┐  ┌────────────────────┐ ┌──────────────┐  │
│  │ KnowledgeService   │  │ PromptBuilderService│ │ OllamaService│  │
│  │ (signal state)     │  │ (template theo     │ │ (fetch +     │  │
│  │ src/app/ai/services│  │  domain)            │ │  NDJSON      │  │
│  │ /knowledge.service │  │                     │ │  streaming)  │  │
│  └─────────┬──────────┘  └─────────────────────┘ └──────┬───────┘  │
│            │                                              │          │
│            │ search(query)                               │ POST    │
│            ▼                                              ▼          │
│  ┌────────────────────┐                       /api/ai/chat        │
│  │ SearchEngineService│                                   │       │
│  │ (substring + score)│                                   │       │
│  └─────────┬──────────┘                                   │       │
│            │                                              │       │
└────────────┼──────────────────────────────────────────────┼───────┘
             │                                              │
             │ đọc JSON                                    │
             ▼                                              │
   src/assets/                                              │
   ├── kanji-words-data/{N2,N3,N4}/*.json                  │
   ├── vocab-data/{N3,N4}/*.json                           │
   ├── kanji-radicard-data/*.json                          │
   └── reduplicative-words-data/*.json                     │
                                                              │
                                                              ▼
   ┌──────────────────────────────────────────────────────────┐
   │              EXPRESS SSR (src/server.ts :4000)             │
   │  POST /api/ai/chat  →  http://localhost:11434/api/chat   │
   │  (giữ CORS ngầm: same-origin vì browser gọi :4000)       │
   └──────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │   Ollama server local       │
                    │   model: qwen2.5:7b         │
                    │   (hoặc llama3.1 / mistral) │
                    └─────────────────────────────┘
```

### 2.2. Luồng chi tiết từng bước

**Bước 0 – Bootstrap (1 lần, lúc AppModule init)**
```
KnowledgeService.constructor()
   → for mỗi folder JSON trong assets/:
       for mỗi file:
         HttpClient.get(url) → lưu vào signal `itemsByDomain[domain]`
   → build index (tokenize từng item → Map<token, KnowledgeItem[]>)
```

**Bước 1 – User nhập câu hỏi (UI)**
```
AiAssistantComponent.onSubmit()
   → AiService.ask(question)
```

**Bước 2 – Phân loại domain**
```
detectDomain(question):
   - keyword "bộ thủ / radical / 部首" → 'radical'
   - keyword "ngữ pháp / grammar / たら / ば / と" → 'grammar'
   - keyword "từ vựng / vocab / hiragana / romaji" → 'vocab'
   - default → 'kanji-word' (vì là chủ đạo dữ liệu)
```

**Bước 3 – Search dữ liệu**
```
searchContext(domain, question, topK=5):
   - SearchEngineService.search(question, itemsByDomain[domain], topK)
   - return KnowledgeItem[] liên quan + summary ngắn
```

**Bước 4 – Build prompt**
```
PromptBuilderService.build(domain, context, question):
   - system = SYSTEM_PROMPT[domain]   // 4 system prompt viết sẵn
   - contextJSON = JSON.stringify(context.items.map(toPromptShape))
   - user = TEMPLATE[domain](context, question)
   - return { system, user, fullPrompt }
```

**Bước 5 – Gọi Ollama qua SSR proxy**
```
OllamaService.streamChat(fullPrompt):
   - fetch('/api/ai/chat', { method: 'POST', body: JSON.stringify({...}) })
   - response.body = ReadableStream<Uint8Array>
   - parse NDJSON từng dòng
   - mỗi { response: "..." } → signal.update(content => content + token)
   - { done: true } → complete()
```

**Bước 6 – Validate**
```
AiService.validate(answer, context):
   - responseValidator.check(answer, context.items)
     → nếu phát hiện token Kanji/từ vựng không có trong JSON
     → set flag hallucinated=true, prefix "(có thể không chính xác) "
   - lưu vào AiHistoryService
   - return AiChatMessage hoàn chỉnh
```

### 2.3. Điểm tích hợp vào Angular hiện có

| Vị trí | Tích hợp | Mục đích |
|---|---|---|
| `src/app/app-routing.module.ts` | Thêm `loadChildren` cho `ai-assistant` | Lazy load module AI |
| `src/app/app.routes.server.ts` | Thêm route `/ai-assistant` → `RenderMode.Server` | Tránh prerender (vì phụ thuộc browser fetch) |
| `src/app/home/home.component.ts` | Thêm menu item thứ 6 | Điểm vào từ landing |
| `src/server.ts` | Thêm `app.post('/api/ai/chat', ...)` | Proxy tới Ollama |
| `src/environments/` | **TẠO MỚI** `environment.ts` + `environment.prod.ts` | Quản lý endpoint AI, model mặc định |
| `angular.json` | Thêm `fileReplacements` cho environment | Đảm bảo prod build dùng file prod |
| `src/app/app.module.ts` | Không cần sửa (AiModule tự lazy load) | – |

---

## 3. Danh sách file cần tạo

> Tất cả đường dẫn dưới đây là **tuyệt đối**, dựa trên cấu trúc `src/app/` hiện hữu.

### 3.1. Folder mới
```
src/app/ai/
├── ai.module.ts
├── ai-routing.module.ts
├── models/
│   ├── knowledge.model.ts
│   ├── prompt.model.ts
│   ├── ai-chat.model.ts
│   └── stream-event.model.ts
├── services/
│   ├── knowledge.service.ts
│   ├── search-engine.service.ts
│   ├── prompt-builder.service.ts
│   ├── ollama.service.ts
│   ├── ai.service.ts
│   ├── cache.service.ts
│   ├── ai-history.service.ts
│   └── ai-settings.service.ts
├── utils/
│   ├── tokenizer.util.ts
│   ├── romanize.util.ts
│   ├── text-similarity.util.ts
│   ├── string-normalize.util.ts
│   ├── response-validator.util.ts
│   └── abortable-stream.util.ts
└── components/
    ├── ai-assistant/
    │   ├── ai-assistant.component.ts
    │   ├── ai-assistant.component.html
    │   ├── ai-assistant.component.css
    │   └── ai-assistant.component.module.ts
    ├── ai-chat-bubble/
    │   ├── ai-chat-bubble.component.ts
    │   ├── ai-chat-bubble.component.html
    │   ├── ai-chat-bubble.component.css
    │   └── ai-chat-bubble.component.module.ts
    ├── ai-suggestion-chips/
    │   ├── ai-suggestion-chips.component.ts
    │   ├── ai-suggestion-chips.component.html
    │   ├── ai-suggestion-chips.component.css
    │   └── ai-suggestion-chips.component.module.ts
    ├── ai-context-preview/
    │   ├── ai-context-preview.component.ts
    │   ├── ai-context-preview.component.html
    │   ├── ai-context-preview.component.css
    │   └── ai-context-preview.component.module.ts
    └── ai-settings/
        ├── ai-settings.component.ts
        ├── ai-settings.component.html
        ├── ai-settings.component.css
        └── ai-settings.component.module.ts
```

### 3.2. File mới trong assets
```
src/assets/ai/
├── manifest.json                    # khai báo tất cả file JSON cần load
└── sample-questions.json            # 6-10 câu hỏi mẫu cho suggestion chips
```

### 3.3. File mới khác
```
src/environments/
├── environment.ts                   # ollamaEndpoint: '/api/ai/chat', model: 'qwen2.5:7b'
└── environment.prod.ts              # cùng nội dung (chưa cần tách prod)

scripts/
├── fix-bom.mjs                      # sửa BOM UTF-8 cho 46 file N2 (Phase 1.11)
└── audit-n2.mjs                     # audit kanji-words-data/N2 xem file nào rỗng (Phase 1.12b)
```

### 3.4. File test mới
```
src/app/ai/services/__tests__/
├── knowledge.service.spec.ts
├── search-engine.service.spec.ts
├── prompt-builder.service.spec.ts
├── response-validator.util.spec.ts
└── string-normalize.util.spec.ts
```

### 3.5. Bảng tóm tắt các file sẽ tạo

| # | Đường dẫn | Loại | Phase |
|---|---|---|---|
| 1 | `src/app/ai/ai.module.ts` | NgModule | 1 |
| 2 | `src/app/ai/ai-routing.module.ts` | NgModule (router) | 1 |
| 3 | `src/app/ai/models/knowledge.model.ts` | Interface | 1 |
| 4 | `src/app/ai/models/prompt.model.ts` | Interface | 1 |
| 5 | `src/app/ai/models/ai-chat.model.ts` | Interface | 1 |
| 6 | `src/app/ai/models/stream-event.model.ts` | Interface | 1 |
| 7 | `src/app/ai/services/knowledge.service.ts` | Service | 1 |
| 8 | `src/app/ai/services/search-engine.service.ts` | Service | 1 |
| 9 | `src/app/ai/services/prompt-builder.service.ts` | Service | 1 |
| 10 | `src/app/ai/services/ollama.service.ts` | Service | 1 |
| 11 | `src/app/ai/services/ai.service.ts` | Service | 1 |
| 12 | `src/app/ai/services/cache.service.ts` | Service | 3 |
| 13 | `src/app/ai/services/ai-history.service.ts` | Service | 2 |
| 14 | `src/app/ai/services/ai-settings.service.ts` | Service | 2 |
| 15 | `src/app/ai/utils/tokenizer.util.ts` | Function module | 1 |
| 16 | `src/app/ai/utils/romanize.util.ts` | Function module | 1 |
| 17 | `src/app/ai/utils/text-similarity.util.ts` | Function module | 1 |
| 18 | `src/app/ai/utils/string-normalize.util.ts` | Function module | 1 |
| 19 | `src/app/ai/utils/response-validator.util.ts` | Function module | 1 |
| 20 | `src/app/ai/utils/abortable-stream.util.ts` | Function module | 1 |
| 21 | `src/app/ai/components/ai-assistant/*` (4 file) | Component + Module | 1 |
| 22 | `src/app/ai/components/ai-chat-bubble/*` (4 file) | Component + Module | 1 |
| 23 | `src/app/ai/components/ai-suggestion-chips/*` (4 file) | Component + Module | 2 |
| 24 | `src/app/ai/components/ai-context-preview/*` (4 file) | Component + Module | 2 |
| 25 | `src/app/ai/components/ai-settings/*` (4 file) | Component + Module | 2 |
| 26 | `src/assets/ai/manifest.json` | JSON | 1 |
| 27 | `src/assets/ai/sample-questions.json` | JSON | 2 |
| 28 | `src/environments/environment.ts` | TS config | 1 |
| 29 | `src/environments/environment.prod.ts` | TS config | 1 |
| 30 | `scripts/fix-bom.mjs` | Node script | 1 |
| 31 | `scripts/audit-n2.mjs` | Node script | 1 |
| 32 | `src/app/ai/services/__tests__/*.spec.ts` (5 file) | Karma test | 3 |

**Tổng: ~55 file mới**.

---

## 4. Danh sách file cần sửa

| # | File | Lý do sửa | Phase |
|---|---|---|---|
| 1 | `src/app/app-routing.module.ts` | Thêm `loadChildren` cho AiModule; import `HomeComponent` đã có sẵn vẫn giữ | 1 |
| 2 | `src/app/app.routes.server.ts` | Thêm route `/ai-assistant` với `RenderMode.Server` (KHÔNG prerender vì phụ thuộc fetch runtime) | 1 |
| 3 | `src/app/home/home.component.ts` | Thêm menu item thứ 6 (`path: '/ai-assistant'`, `icon: '🤖'`) | 1 |
| 4 | `src/server.ts` | Thêm `app.post('/api/ai/chat', ...)` để proxy sang Ollama (cần `node-fetch` hoặc dùng `http.request`) | 1 |
| 5 | `angular.json` | Thêm `fileReplacements` cho production để swap `environment.ts` ↔ `environment.prod.ts` | 1 |
| 6 | `src/styles.css` | Thêm CSS chung cho chat UI (gradient bubble, scroll) – tùy chọn, có thể nhét trong component | 1 |
| 7 | `src/app/app.module.ts` | Import `HttpClientModule` nếu chưa có (đã có trong current code – chỉ xác nhận) | 1 |
| 8 | `src/assets/kanji-words-data/N2/lesson*.json` (46 file) | Loại bỏ BOM UTF-8 (chạy `scripts/fix-bom.mjs`) | 1 |
| 9 | `src/assets/list-music/playlist.json` | Sửa typo `"ESound Of My Dream Remix.mp3"` → `"Sound Of My Dream Remix.mp3"` | 1 |
| 10 | `package.json` | (tuỳ chọn) xoá `openai` nếu không dùng cloud, hoặc thêm `wanakana` nếu cần romanize | 1 (quyết định sau) |
| 11 | `ngsw-config.json` | Thêm `/api/ai/chat` vào `dataGroups` (không cache – `strategy: freshness`, `maxAge: 1d`) | 1 |
| 12 | `src/index.html` | Có thể thêm `<meta>` description cho trang AI (SEO) – tuỳ chọn | 3 |
| 13 | `src/app/kanjiWords/flashcard/flashcard.component.ts` (sau này) | Bổ sung nút "Hỏi AI về kanji này" → mở AiAssistant với prefill – Phase 2 | 2 |
| 14 | `src/app/vocabulary/flashcard/flashcard.component.ts` (sau này) | Tương tự – nút hỏi AI về từ vựng | 2 |
| 15 | `src/app/kanjiRadicals/flashcard/flashcard.component.ts` | Nút hỏi AI về bộ thủ | 2 |

**Không sửa:**
- Các file test, karma.conf.js, tsconfig (giữ nguyên – đã tương thích Angular 19 application builder).
- `capacitor.config.ts` (không liên quan AI).
- `app.component.{ts,html,css}` (giữ nguyên – AI là 1 route riêng, không nhúng vào shell).

---

## 5. Phân chia phase

### Phase 1 — MVP (BẮT BUỘC)
Mục tiêu: User có thể mở `/ai-assistant`, gõ câu hỏi, nhận câu trả lời dựa trên JSON, streaming tokens, không bịa.

| Sub-phase | Nội dung | Tiêu chí pass |
|---|---|---|
| **1.A — Khung + Config** | Folder `ai/`, 4 interface, `environment.ts`, `angular.json` fileReplacements | `ng build` pass |
| **1.B — Knowledge layer** | `KnowledgeService` + `SearchEngineService` + 4 utility (normalize, tokenizer, similarity, romanize) | Load xong 7 folder JSON, search "kanji 食" trả về ≥ 1 item |
| **1.C — LLM layer** | `OllamaService` (NDJSON streaming) + `PromptBuilderService` (4 system prompt) + `/api/ai/chat` proxy trong `src/server.ts` | `curl -X POST /api/ai/chat` trả về NDJSON hợp lệ |
| **1.D — Orchestrator + UI** | `AiService`, `AiAssistantComponent`, `AiChatBubbleComponent`, route lazy, menu integration | Mở `/ai-assistant`, hỏi "Kanji 食 nghĩa là gì?" → nhận câu trả lời streaming + có citation |
| **1.E — Vệ sinh dữ liệu** | Sửa BOM 46 file N2, sửa playlist.json typo | `scripts/fix-bom.mjs` chạy thành công; verify 0 file còn BOM |

### Phase 2 — NÂNG CAO (UX + tiện ích)
| Sub-phase | Nội dung |
|---|---|
| **2.A — Settings + History** | `AiSettingsService`, `AiSettingsComponent`, `AiHistoryService` (localStorage, không cần IndexedDB vì history ngắn hạn) |
| **2.B — Gợi ý + Minh bạch** | `AiSuggestionChipsComponent` (load `sample-questions.json`), `AiContextPreviewComponent` (toggle hiển thị context RAG) |
| **2.C — UX streaming** | Cancel button (AbortController), typing dots, auto-scroll |
| **2.D — Tích hợp sâu** | Thêm nút "Hỏi AI" trong 3 flashcard component (kanjiWords, vocabulary, kanjiRadicals) – truyền `vocabData[0]` làm prefill |
| **2.E — Markdown mini** | Parser đơn giản cho `**bold**`, `*italic*`, `` `code` ``, danh sách `- item` trong `AiChatBubbleComponent` |

### Phase 3 — TỐI ƯU (production-ready)
| Sub-phase | Nội dung |
|---|---|
| **3.A — Cache + Performance** | `CacheService` với TTL 7 ngày (key = hash của `domain+question+topK`), bỏ qua LLM nếu cache hit |
| **3.B — Testing** | Karma test cho 5 file spec, mock OllamaService |
| **3.C — Web Worker** | Chuyển JSON parsing + search index sang worker (nếu load > 2 MB hoặc user phàn nàn lag) |
| **3.D — Telemetry** | Đếm token, thời gian, tỉ lệ cache hit; hiển thị trong AiSettingsComponent |
| **3.E — Graceful degradation** | Nếu Ollama down → hiển thị banner "AI không khả dụng" + gợi ý mở flashcards tương ứng |

---

## 6. Checklist triển khai

> Mỗi dòng là 1 task nhỏ nhất, có thể check xong trong 5-60 phút.

### Phase 1

#### 1.A — Khung + Config
- [ ] Tạo folder `src/app/ai/{models,services,utils,components}` rỗng
- [ ] Tạo `src/app/ai/models/knowledge.model.ts` (KnowledgeDomain, KnowledgeItem, KnowledgeIndex)
- [ ] Tạo `src/app/ai/models/prompt.model.ts` (PromptContext, PromptTemplate, 4 TEMPLATE const)
- [ ] Tạo `src/app/ai/models/ai-chat.model.ts` (AiChatMessage, AiChatSession, AiSettings)
- [ ] Tạo `src/app/ai/models/stream-event.model.ts` (OllamaStreamEvent, OllamaChatRequest)
- [ ] Tạo `src/environments/environment.ts` với `ollamaProxy: '/api/ai/chat'`, `defaultModel: 'qwen2.5:7b'`
- [ ] Tạo `src/environments/environment.prod.ts` (giống environment.ts)
- [ ] Sửa `angular.json` → thêm `fileReplacements` cho `production` configuration: `replace: src/environments/environment.ts → environment.prod.ts`
- [ ] Tạo `src/assets/ai/manifest.json` liệt kê các file JSON cần load

#### 1.B — Knowledge layer
- [ ] Tạo `src/app/ai/utils/string-normalize.util.ts` (export `normalizeVi()`, `normalizeJa()`)
- [ ] Tạo `src/app/ai/utils/tokenizer.util.ts` (export `tokenize()` cho romaji/hiragana/kanji)
- [ ] Tạo `src/app/ai/utils/text-similarity.util.ts` (export `jaccard()`, `substringScore()`)
- [ ] Tạo `src/app/ai/utils/romanize.util.ts` (no-op fallback, để sau dùng wanakana)
- [ ] Tạo `src/app/ai/services/search-engine.service.ts` (SearchEngineService với method `search(query, items, topK)`)
- [ ] Tạo `src/app/ai/services/knowledge.service.ts` (KnowledgeService với signal `itemsByDomain`, `loadAll()`, `search()`)
- [ ] Tạo `src/app/ai/ai.module.ts` (khai báo providers + import HttpClientModule)
- [ ] Tạo `src/app/ai/ai-routing.module.ts` (placeholder, chưa có route con)
- [ ] Test thủ công: inject KnowledgeService vào HomeComponent tạm, log `itemsByDomain()['kanji-word'].length`

#### 1.C — LLM layer
- [ ] Tạo `src/app/ai/utils/abortable-stream.util.ts` (export `streamNdjson(url, body, signal): AsyncIterable<OllamaStreamEvent>`)
- [ ] Tạo `src/app/ai/services/ollama.service.ts` (OllamaService với method `chat(prompt): Observable<string>` token stream)
- [ ] Tạo `src/app/ai/services/prompt-builder.service.ts` (PromptBuilderService với `build(domain, context, question)`)
- [ ] Sửa `src/server.ts` thêm `app.post('/api/ai/chat', proxyToOllama)` + `proxyToOllama()` function
- [ ] Test: `curl -X POST http://localhost:4000/api/ai/chat -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"hi"}]","model":"qwen2.5:7b"}'` → nhận NDJSON stream

#### 1.D — Orchestrator + UI
- [ ] Tạo `src/app/ai/services/ai.service.ts` (AiService với `ask(question)`, `detectDomain()`, `validate()`)
- [ ] Tạo `src/app/ai/utils/response-validator.util.ts` (export `validate(answer, contextItems)`)
- [ ] Tạo `src/app/ai/components/ai-chat-bubble/*` (4 file) – component hiển thị 1 message
- [ ] Tạo `src/app/ai/components/ai-assistant/*` (4 file) – container với input + list bubble + scroll auto
- [ ] Tạo `src/app/ai/ai-routing.module.ts` (thêm route `path: '' → AiAssistantComponent`)
- [ ] Sửa `src/app/app-routing.module.ts` thêm `loadChildren: () => import('./ai/ai.module').then(m => m.AiModule)`
- [ ] Sửa `src/app/app.routes.server.ts` thêm `{ path: 'ai-assistant', renderMode: RenderMode.Server }`
- [ ] Sửa `src/app/home/home.component.ts` thêm menu item `{ path: '/ai-assistant', title: 'Trợ lý AI', icon: '🤖', gradient: '...' }`
- [ ] Sửa `ngsw-config.json` thêm `dataGroups` cho `/api/ai/chat`
- [ ] Test E2E thủ công: chạy `ng serve`, mở `http://localhost:3001/ai-assistant`, gõ "Kanji 食 nghĩa là gì?", xem streaming trả lời

#### 1.E — Vệ sinh dữ liệu
- [ ] Tạo `scripts/fix-bom.mjs` (Node script: đọc file, bỏ BOM nếu có, ghi lại UTF-8)
- [ ] Chạy `node scripts/fix-bom.mjs` cho `src/assets/kanji-words-data/N2/*.json`
- [ ] Verify: `file src/assets/kanji-words-data/N2/lesson1.json` → "UTF-8 Unicode text" (không còn "UTF-8 Unicode (with BOM) text")
- [ ] Tạo `scripts/audit-n2.mjs` (đếm số items mỗi file, xuất file rỗng / trùng)
- [ ] Sửa `src/assets/list-music/playlist.json` (xoá chữ "E" thừa trong `"ESound Of My Dream Remix.mp3"`)

### Phase 2

- [ ] Tạo `src/app/ai/services/ai-settings.service.ts` (lưu/đọc AiSettings từ localStorage)
- [ ] Tạo `src/app/ai/services/ai-history.service.ts` (lưu AiChatSession vào localStorage, max 20 session)
- [ ] Tạo `src/app/ai/components/ai-settings/*` (4 file) – UI cấu hình endpoint, model, temperature, topK
- [ ] Tạo `src/app/ai/components/ai-suggestion-chips/*` (4 file) – load `sample-questions.json`, hiển thị chip
- [ ] Tạo `src/app/ai/components/ai-context-preview/*` (4 file) – toggle hiển thị JSON context gửi kèm
- [ ] Tạo `src/assets/ai/sample-questions.json` (6-10 câu hỏi mẫu, chia 4 domain)
- [ ] Sửa `src/app/ai/components/ai-assistant/ai-assistant.component.ts` thêm nút Stop gọi `AbortController`
- [ ] Sửa `src/app/ai/components/ai-assistant/ai-assistant.component.css` thêm hiệu ứng typing dots
- [ ] Sửa `src/app/ai/components/ai-chat-bubble/ai-chat-bubble.component.ts` thêm markdown parser inline
- [ ] Sửa `src/app/kanjiWords/flashcard/flashcard.component.html` thêm nút "Hỏi AI" → `router.navigate(['/ai-assistant'], { queryParams: { prefill: vocabData[currentIndex].kanji } })`
- [ ] Sửa `src/app/vocabulary/flashcard/flashcard.component.html` tương tự
- [ ] Sửa `src/app/kanjiRadicals/flashcard/flashcard.component.html` tương tự
- [ ] Sửa `src/app/ai/ai-routing.module.ts` đọc `queryParams.prefill` và prefill input

### Phase 3

- [ ] Tạo `src/app/ai/services/cache.service.ts` (LRU + TTL 7 ngày, hash key)
- [ ] Sửa `src/app/ai/services/ai.service.ts` tích hợp cache lookup đầu hàm `ask()`
- [ ] Tạo `src/app/ai/services/__tests__/string-normalize.util.spec.ts`
- [ ] Tạo `src/app/ai/services/__tests__/search-engine.service.spec.ts`
- [ ] Tạo `src/app/ai/services/__tests__/knowledge.service.spec.ts`
- [ ] Tạo `src/app/ai/services/__tests__/prompt-builder.service.spec.ts`
- [ ] Tạo `src/app/ai/services/__tests__/response-validator.util.spec.ts`
- [ ] Chạy `ng test --watch=false --browsers=ChromeHeadlessCI` → 5/5 pass
- [ ] (Optional) Tạo `src/app/ai/workers/knowledge.worker.ts` + sửa KnowledgeService dùng worker
- [ ] Sửa `src/app/ai/components/ai-assistant/ai-assistant.component.ts` thêm telemetry counters
- [ ] Sửa `src/app/ai/components/ai-settings/ai-settings.component.html` thêm bảng stats
- [ ] Sửa `src/app/ai/services/ai.service.ts` thêm try/catch quanh OllamaService.chat(), set `serviceAvailable=false` nếu lỗi
- [ ] Sửa `src/app/ai/components/ai-assistant/ai-assistant.component.html` hiển thị banner warning khi `!serviceAvailable`

---

## 7. Chiến lược testing

### 7.1. Unit test (Karma + Jasmine, theo config hiện có)

| File test | Testcase cụ thể |
|---|---|
| `string-normalize.util.spec.ts` | (1) `normalizeVi("Đàn Ông")` → "dan ong". (2) `normalizeJa("こんにちは")` → giữ nguyên. (3) `normalizeJa("  食べ  る ")` → bỏ space. |
| `text-similarity.util.spec.ts` | (1) `jaccard("kanji", "kanji")` → 1.0. (2) `jaccard("kanji", "radical")` → 0. (3) `substringScore("kanji", "kanjiword")` → > 0.5. |
| `search-engine.service.spec.ts` | (1) `search("食", vocabItems, 5)` trả về items có `kanji='食'`. (2) `search("không tồn tại", ...)` trả về `[]`. (3) Top-K đúng số lượng. |
| `knowledge.service.spec.ts` | (1) Mock HttpClient trả về JSON mẫu → service load xong → `itemsByDomain()['vocab'].length` đúng. (2) `search("nam tính", 'vocab', 3)` trả về items có `hanViet` chứa "nam". (3) Lỗi HTTP → service vẫn hoạt động (skip file lỗi). |
| `prompt-builder.service.spec.ts` | (1) `build('kanji-word', ctx, "nghĩa của 食")` → system prompt có "kanji-word", user prompt có JSON context. (2) `build('grammar', ctx, "たら là gì")` → system prompt có "Không có trong dữ liệu". |
| `response-validator.util.spec.ts` | (1) Câu trả lời chứa `"XỊ"` (không có trong JSON) → flag `hallucinated=true`. (2) Câu trả lời chứa `"男性"` (có trong JSON) → flag `false`. (3) Câu trả lời chỉ có disclaimer → flag `false`. |
| `ollama.service.spec.ts` | (1) Mock fetch trả NDJSON → service emit tokens đúng thứ tự. (2) Abort signal giữa chừng → complete với error. |

### 7.2. Integration test (mock Ollama)

| Testcase | Cách test |
|---|---|
| `AiService.ask("Kanji 食 nghĩa là gì?")` → trả về câu trả lời có citation | Mock `KnowledgeService.search` trả 1 item `kanji='食'`. Mock `OllamaService.chat` trả `"Kanji 食 có nghĩa là ăn..."`. Verify câu trả lời chứa token `"ăn"` và `sourceCitations=[item.id]`. |
| `AiService.ask("Ngữ pháp ～たら")` → disclaimer xuất hiện | Mock KnowledgeService trả `[]` cho domain 'grammar'. Verify câu trả lời prefix có "Không có trong dữ liệu JSON". |
| `AiService.ask("xyz không tồn tại")` → domain detection fallback 'kanji-word' | Verify `searchContext` được gọi với domain='kanji-word'. |

### 7.3. E2E test (manual checklist – không dùng Cypress trong Phase 1)

| # | Bước | Kỳ vọng |
|---|---|---|
| 1 | Khởi động Ollama: `ollama serve` + `ollama pull qwen2.5:7b` | OK |
| 2 | `ng serve` | Server lên port 3001 |
| 3 | Mở `http://localhost:3001/`, click menu "🤖 Trợ lý AI" | Navigate `/ai-assistant` |
| 4 | Thấy 6-10 suggestion chips | Render OK |
| 5 | Click chip "Cho ví dụ về kanji 食" → input prefill + auto-submit | Token stream hiển thị trong bubble |
| 6 | Câu trả lời có citation `[1]` trỏ file JSON | Hover hiện tooltip |
| 7 | Hỏi "Ngữ pháp たら" → response có disclaimer | OK |
| 8 | Hỏi lại câu trước → cache hit (response time < 100ms) | OK (Phase 3) |
| 9 | Tắt Ollama → hỏi tiếp → banner lỗi hiện | OK (Phase 3) |
| 10 | `ng build --configuration production` | Pass, initial bundle ≤ 2.5 MB |

### 7.4. Lệnh test thực thi

```bash
# Unit test
cd H:\Scripts\japanese-vocab-app
./node_modules/.bin/ng test --watch=false --browsers=ChromeHeadlessCI

# Build verify
./node_modules/.bin/ng build --configuration production

# Lint (nếu muốn thêm ESLint trước Phase 3)
./node_modules/.bin/ng lint  # cần cài eslint trước
```

### 7.5. Tiêu chí pass/fail

| Tiêu chí | Mục tiêu |
|---|---|
| Unit test pass | 100% (Phase 3) |
| Build pass | Bắt buộc mỗi phase |
| Bundle size tăng | ≤ 50 KB (lazy load AI module) |
| Streaming latency | First token < 2s (Ollama local) |
| Citation accuracy | ≥ 80% câu hỏi kanji/vocab/radical có citation hợp lệ |

---

## 8. Đánh giá rủi ro

### 8.1. Rủi ro kỹ thuật

| # | Rủi ro | Xác suất | Tác động | Giảm thiểu |
|---|---|---|---|---|
| **R1** | **CORS chặn browser → Ollama** nếu user cấu hình sai | Cao | Cao | Phase 1.8 proxy qua Express SSR `/api/ai/chat` đã bypass hoàn toàn |
| **R2** | **BOM UTF-8** 46 file N2 làm `KnowledgeService.loadAll()` throw | Cao | Trung bình | Phase 1.11 fix-bom.mjs chạy trước |
| **R3** | **Ollama không có sẵn model** khi user cài đặt lần đầu | Cao | Trung bình | Phase 2 banner "service unavailable" + hướng dẫn `ollama pull qwen2.5:7b` |
| **R4** | **AI bịa đáp án** cho câu hỏi ngoài JSON (grammar, nuance) | Rất cao | Cao | (a) System prompt cứng cấm bịa. (b) Phase 1.10 response-validator. (c) Phase 3 disclaimer luôn hiển thị |
| **R5** | **Streaming parse NDJSON** lỗi trên trình duyệt cũ (Safari < 14) | Thấp | Trung bình | Dùng polyfill `ReadableStream` (đã có sẵn trong Angular 19 zone polyfill) |
| **R6** | **Bundle size phình** nếu lỡ thêm wanakana (~200 KB) hoặc marked (~50 KB) | Trung bình | Trung bình | Phase 1 dùng tokenizer tự viết (đã đủ). Chỉ thêm wanakana nếu test thực tế thấy cần. Phase 2 markdown mini-parser viết tay |
| **R7** | **Service Worker cache cũ** khi deploy | Trung bình | Thấp | Tăng version trong `ngsw-config.json` mỗi release. Thêm `?v=timestamp` query cho asset AI |
| **R8** | **localStorage quota** (5 MB) bị đầy nếu history chat quá dài | Thấp | Thấp | Phase 2 AiHistoryService cap 20 session, mỗi session 50 message |
| **R9** | **Memory leak** do Subscribe Ollama stream không unsubscribe | Trung bình | Trung bình | Dùng `takeUntilDestroyed(this.destroyRef)` (Angular 19) hoặc AbortController |
| **R10** | **SSR rendering error** khi KnowledgeService load JSON (window không có) | Trung bình | Trung bình | Guard tất cả HttpClient bằng `isPlatformBrowser()` (đã có pattern trong MusicPlayerService) |

### 8.2. Rủi ro dữ liệu

| # | Rủi ro | Xác suất | Tác động | Giảm thiểu |
|---|---|---|---|---|
| **D1** | `kanji-words-data/N2` chỉ 35 items → câu hỏi về kanji N2 ít dữ liệu → AI hallucinate | Cao | Cao | Phase 1.12b audit-n2.mjs phát hiện file rỗng. Bổ sung data hoặc ẩn domain N2 khỏi AI trong Phase 2 |
| **D2** | Field `mnemonic` không có trong N2 (chỉ N3/N4) → AI không có "mẹo nhớ" | Trung bình | Thấp | PromptBuilder bỏ qua field null |
| **D3** | `playlist.json` typo "ESound Of..." | Xác định | Thấp | Phase 1.12 sửa |
| **D4** | Không có `grammar-data/` | Xác định | Cao | Phase 1 chấp nhận grammar chỉ từ model thuần + disclaimer. Phase 2.7 yêu cầu user cung cấp data |

### 8.3. Rủi ro UX

| # | Rủi ro | Xác suất | Tác động | Giảm thiểu |
|---|---|---|---|---|
| **U1** | User hỏi ngôn ngữ không xác định (Anh?) → model trả tiếng Anh | Trung bình | Trung bình | PromptBuilder ép output tiếng Việt + tiếng Nhật |
| **U2** | User hỏi chủ đề ngoài phạm vi (lịch sử Nhật Bản) → model trả generic | Cao | Thấp | System prompt giới hạn "chỉ trả lời về Kanji/Từ vựng/Bộ thủ/Ngữ pháp N2-N4". Ngoài phạm vi → từ chối lịch sự |
| **U3** | Streaming bị giật trên mobile yếu | Trung bình | Trung bình | Phase 3 thử Web Worker |
| **U4** | User không biết Ollama là gì → bỏ cuộc | Cao | Cao | Cần 1 file `INSTALL_OLLAMA.md` hướng dẫn cài đặt (Phase 3 tạo) |

### 8.4. Rủi ro vận hành

| # | Rủi ro | Xác suất | Tác động | Giảm thiểu |
|---|---|---|---|---|
| **O1** | User deploy production mà quên chạy Ollama trên server | Cao | Cao | Banner rõ ràng trong AiAssistantComponent. Phase 3 fallback "AI offline → dùng flashcards" |
| **O2** | Ollama quá tải khi nhiều user cùng truy cập (multi-tenant) | Thấp (app PWA cá nhân) | Trung bình | Cache 7 ngày giảm tải 80% |
| **O3** | Bản cập nhật model Ollama mới thay đổi response format | Thấp | Trung bình | Parser NDJSON linh hoạt (`response?: string`, `done?: boolean` optional) |

### 8.5. Kế hoạch dự phòng (fallback)

| Tình huống | Plan B |
|---|---|
| Ollama không khả dụng | Banner "AI đang bảo trì", gợi ý dùng flashcard |
| Model quá yếu (3B) bịa nhiều | Gắn flag "có thể không chính xác" lên mọi response |
| User muốn cloud thay vì local | Phase 2.8 giữ `openai` package, thêm `OpenAiService` implement cùng interface `LlmBackend` |
| Wanakana cần thiết nhưng bundle quá lớn | Lazy import chỉ trong AiModule, không ảnh hưởng shell |

---

> **Kết thúc kế hoạch.** File lưu tại `H:\Scripts\japanese-vocab-app\AI_IMPLEMENTATION_PLAN.md`.
> Bước tiếp theo: chờ user phê duyệt Phase 1 checklist, sau đó mới bắt đầu code theo thứ tự 1.A → 1.B → 1.C → 1.D → 1.E.