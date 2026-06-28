# AI_ARCHITECTURE_REVIEW

> Báo cáo phân tích kiến trúc & thiết kế tích hợp AI cho dự án **JapaneseVocabApp**
> Đường dẫn: `H:\Scripts\japanese-vocab-app`
> Ngày phân tích: 2026-06-27
> Vai trò thực hiện: Principal Software Architect · Senior Angular Developer · AI Integration Engineer
>
> **Phạm vi:** CHỈ PHÂN TÍCH – KHÔNG CODE – KHÔNG SỬA FILE NGUỒN.

---

## Mục lục
1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Các màn hình hiện có](#2-các-màn-hình-hiện-có)
3. [Các service hiện có](#3-các-service-hiện-có)
4. [Các model / interface / DTO hiện có](#4-các-model--interface--dto-hiện-có)
5. [Các file JSON dữ liệu](#5-các-file-json-dữ-liệu)
6. [Đánh giá khả năng tích hợp AI](#6-đánh-giá-khả-năng-tích-hợp-ai)
7. [Thiết kế kiến trúc AI tối ưu](#7-thiết-kế-kiến-trúc-ai-tối-ưu)
8. [Thiết kế module / component / service mới](#8-thiết-kế-module--component--service-mới)
9. [Lập TODO theo phase](#9-lập-todo-theo-phase)
10. [Ước lượng độ khó & thời gian](#10-ước-lượng-độ-khó--thời-gian)
11. [Phụ lục: Vấn đề kỹ thuật hiện tại](#11-phụ-lục-vấn-đề-kỹ-thuật-hiện-tại)

---

## 1. Tổng quan dự án

### 1.1. Angular & công cụ
| Mục | Giá trị |
|---|---|
| Angular CLI | 19.0.6 |
| Angular framework | @angular/* ^19.0.0 |
| Builder | @angular-devkit/build-angular:application |
| Renderer | SSR + Prerender (RenderMode.Prerender cho mọi route) |
| Style | CSS thuần (không dùng Tailwind/Material/PrimeNG) |
| Test | Karma + Jasmine (ChromeHeadless CI), single-run |
| Output mode | `outputMode: "server"` (SSR) + `serviceWorker: ngsw-config.json` cho PWA |
| Dev server | `localhost:3001` |
| Budget (production) | initial ≤ 1 MB, component CSS ≤ 8 KB |
| TypeScript | ~5.6.2, strict + strictTemplates + noImplicitOverride |
| Target | ES2022 / module ES2022 |
| PWA | Có (`ngsw-config.json`, asset group + dataGroup cho vocab JSON) |

### 1.2. Thư viện chính đang dùng
- `@angular/{animations, common, compiler, core, forms, platform-browser, platform-server, router, service-worker, ssr}` ^19.0.0
- `@angular/ssr` ^19.0.6 – SSR runtime
- `express` ^4.18.2 – server runtime
- `@capacitor/{core, cli, android}` ^7.1.0 – đã đóng gói Android (appId `dungcts.japanese.app`)
- `openai` ^4.86.1 – **ĐÃ KHAI BÁO NHƯNG CHƯA ĐƯỢC IMPORT TRONG `src/`**
- `rxjs` ~7.8.0, `zone.js` ~0.15.0, `tslib` ^2.3.0
- Web APIs: `SpeechSynthesisUtterance` (đọc tiếng Nhật), `webkitSpeechRecognition` (nhận diện giọng nói)
- HTML5 Audio API cho music player

### 1.3. UI Framework
- **Không dùng** UI framework thương mại. CSS thuần + Google Fonts (`Noto Sans JP`).
- CSS đặt thủ công theo từng component, có gradient, hero, animation riêng.
- Home page có design riêng với hiệu ứng cánh hoa anh đào (🌸).

### 1.4. Routing
Cấu trúc routing lai (eager + lazy):
```
''         → redirect /home
'/home'    → HomeComponent (eager, khai báo trong AppModule)
'/vocabulary'         → loadChildren (lazy)
'/kanji-words'        → loadChildren (lazy)
'/kanji-radicals'     → loadChildren (lazy)
'/reduplicative-words'→ loadChildren (lazy)
'**'                  → redirect /home
```
- Mỗi layout module đều tự khai báo route con với `RouterModule.forChild`.
- Server routes: tất cả `**` dùng `RenderMode.Prerender` (tĩnh, không có API runtime).
- **Lưu ý:** Menu home có link `/adverb-radicals` nhưng route này **không tồn tại** trong routing → click sẽ fall về `/home`.

### 1.5. State Management
- **Không có** state management library (Không dùng NgRx, Akita, SignalStore...).
- Dùng **Angular Signals** cục bộ:
  - `MusicPlayerService` dùng `signal()` + `computed()` cho `isPlaying`, `currentTrack`, `hasTracks`.
- Hầu hết các component quản lý state dạng field thường + `@Input()`.
- Một số service dùng **localStorage** làm cache thay vì state toàn cục (cache theo key `kanji-words-N2-lesson1`, `lesson1`, v.v.).

### 1.6. Cấu trúc thư mục
```
H:\Scripts\japanese-vocab-app\
├── angular.json
├── capacitor.config.ts          # appId: dungcts.japanese.app
├── karma.conf.js
├── ngsw-config.json
├── package.json                 # deps openai đã có nhưng chưa dùng
├── tsconfig.{json,app.json,spec.json}
├── android/                     # Capacitor Android project (đã build)
├── dist/                        # Build output SSR (browser + server)
├── node_modules/
└── src/
    ├── index.html
    ├── main.ts / main.server.ts
    ├── server.ts                # Express SSR entry
    ├── styles.css               # Global styles + Noto Sans JP
    ├── app/
    │   ├── app.module.ts        # Khai báo AdverbComponent, MusicPlayerComponent
    │   ├── app.module.server.ts
    │   ├── app-routing.module.ts
    │   ├── app.component.{ts,html,css}
    │   ├── app.routes.server.ts # Prerender mọi route
    │   ├── home/                # Landing menu 5 mục
    │   ├── vocabulary/          # Flashcard + VocabTest
    │   ├── kanjiWords/          # Flashcard + KanjiWordsQuiz
    │   ├── kanjiRadicals/       # Flashcard + KanjiQuiz
    │   ├── reduplicativeWords/  # Flashcard + Quiz
    │   ├── numberPractice/      # NumberJapaneseService + PracticeComponent
    │   ├── adverb/              # Placeholder (chỉ có "adverb works!")
    │   ├── music-player/        # Floating audio player (đang bị comment trong app.component.html)
    │   └── services/
    │       └── music-player.service.ts
    └── assets/
        ├── kanji-words-data/{N2,N3,N4}/lesson*.json
        ├── kanji-radicard-data/lesson*.json
        ├── vocab-data/{N3,N4}/lesson*.json
        ├── reduplicative-words-data/lesson*.json
        └── list-music/*.mp3 + playlist.json
```

---

## 2. Các màn hình hiện có

| # | Tên màn hình | Selector / path | Chế độ học | Nguồn dữ liệu |
|---|---|---|---|---|
| 1 | **Home (Landing)** | `app-home` → `/home` | Menu 5 mục | – |
| 2 | **Học theo Kanji** | `app-layout-kanji-words` → `/kanji-words` | Flashcard / Quiz | `kanji-words-data/{N2,N3,N4}` |
| 3 | **Học Từ Vựng** | `app-layout-vocabulary` → `/vocabulary` | Flashcard / Quiz | `vocab-data/{N3,N4}` |
| 4 | **Học theo Bộ Thủ** | `app-layoutkanji-radicals` → `/kanji-radicals` | Flashcard / Quiz | `kanji-radicard-data` |
| 5 | **Học Từ Láy** | `app-layout-reduplicative-words` → `/reduplicative-words` | Flashcard / Quiz | `reduplicative-words-data` |
| 6 | **Luyện Số** | `app-number-practice` (route hiện chưa wire trong app-routing.module.ts, nhưng có routing module riêng) | Read / Listen | Tính runtime từ `NumberJapaneseService` |
| 7 | **Phó Từ** | `app-adverb` (chỉ placeholder, route `/adverb-radicals` không tồn tại) | – | – |
| 8 | **Music Player** | `app-music-player` (đang comment trong app.component.html) | Floating widget | `assets/list-music/playlist.json` |

**Không có màn hình riêng cho Ngữ pháp, JLPT dashboard, hay lịch sử học tập.** Mỗi layout là một hub có 2 chế độ: `flashcard | quiz`. Quiz có 10 câu, 30 giây/câu, có timer, có answer history.

---

## 3. Các service hiện có

| Service | File | Nhiệm vụ | Được dùng ở |
|---|---|---|---|
| **MusicPlayerService** | `src/app/services/music-player.service.ts` | Phát nhạc nền, signal `isPlaying/currentTrack/hasTracks`, load `playlist.json`, shuffle, prev/next. Tự khởi tạo `Audio` ở browser, fallback rỗng ở SSR. | `MusicPlayerComponent` (đang comment). Có thể inject ở bất kỳ đâu do `providedIn: 'root'`. |
| **NumberJapaneseService** | `src/app/numberPractice/number-japanese.service.ts` | Chuyển số → hiragana (兆/億/万/千/百/十 đầy đủ các trường hợp đặc biệt 3000=さんぜん, 600=ろっぴゃu...), sinh câu hỏi, gọi `SpeechSynthesis` đọc. | `NumberPracticeComponent` |
| **AppRoutingModule** | `src/app/app-routing.module.ts` | Root routing, lazy load 4 layout module. | Bootstrap module |
| **Các Layout\*RoutingModule** | `…/layout-…/*.routing.module.ts` | Con router cho từng nhánh. | Mỗi layout module |

**Không có service dùng chung.** Mỗi layout component tự gọi `HttpClient` riêng để tải JSON và tự cache localStorage. Không có abstraction `DataService` hay `LessonService`.

---

## 4. Các model / interface / DTO hiện có

Hiện **không có folder models/ riêng**. Tất cả interface được khai báo nội bộ trong file `.ts` của từng component (trùng lặp giữa các file).

| Interface | File | Trường |
|---|---|---|
| `MenuItem` | `home.component.ts` | `path, title, description, icon, gradient` |
| `VocabItem` | `vocab-test.component.ts` | `kanji, hiragana, hanViet, meaning` |
| `QuizQuestion` (vocab) | `vocab-test.component.ts` | `question, correctAnswer, options, type, vocabData` |
| `Example` (kanji word) | `kanjiWords/flashcard` & `kanjiWords/quiz` | `word, reading, meaning` |
| `KanjiWord` | `kanjiWords/flashcard` & `kanjiWords/quiz` | `kanji, amHan, nghia, onyomi, kunyomi, examples[], mnemonic?` |
| `QuizQuestion` (kanji word) | `kanjiWords/quiz` | `… type: 'kanji-to-meaning' \| 'kanji-to-amhan' \| 'kanji-to-onyomi' \| 'kanji-to-kunyomi' \| 'amhan-to-kanji' \| 'meaning-to-kanji', kanjiData` |
| `KanjiRadical` | `kanjiRadicals/kanji-quiz` | `radical, meaning, strokeCount, exampleKanji[], memoryTrick, pronunciations[], explanation` |
| `QuizQuestion` (radical) | `kanjiRadicals/kanji-quiz` | `… type: 'radical-to-meaning' \| 'meaning-to-radical'` |
| `ReduplicativeWord` | `reduplicativeWords/quiz` | `japanese, romaji, vietnamese, category` |
| `QuizQuestion` (reduplicative) | `reduplicativeWords/quiz` | `… type: 'japanese-to-vietnamese' \| 'vietnamese-to-japanese' \| 'romaji-to-vietnamese', wordData` |
| `KanjiLevel` (type) | `kanjiWords/lesson-selector` | `'N2' \| 'N3' \| 'N4'` |
| `NumberQuestion` | `number-japanese.service.ts` | `number, japanese, reading, digits` |
| `SessionStat` | `numberPractice.component.ts` | `number, reading, userAnswer, correct, mode` |
| `MusicTrack` | `music-player.service.ts` | `src, title` |
| `ManifestEntry`, `PlaylistManifest` | `music-player.service.ts` | type union + interface cho playlist |
| `Mode` (type) | `numberPractice.component.ts` | `'menu' \| 'read' \| 'listen' \| 'result'` |

**Vấn đề:** Trùng lặp `Example` và `KanjiWord` giữa flashcard và quiz. Thiếu type chuẩn cho JSON trả về từ HttpClient (toàn `any[]`).

---

## 5. Các file JSON dữ liệu

### 5.1. Thống kê tổng quan

| Folder | Cấp | Số file | Items | Tổng dung lượng | Encoding |
|---|---|---|---|---|---|
| `assets/kanji-words-data/N2` | N2 | 48 | 35 (rất ít, có thể file khác rỗng) | ~38 KB | **46/48 file có BOM UTF-8** ⚠ |
| `assets/kanji-words-data/N3` | N3 | 30 | 472 | ~358 KB | UTF-8 |
| `assets/kanji-words-data/N4` | N4 | 26 | 312 | ~224 KB | UTF-8 |
| `assets/vocab-data/N3` | N3 | 22 | 880 | ~92 KB | UTF-8 |
| `assets/vocab-data/N4` | N4 | 25 | 1129 | ~131 KB | UTF-8 |
| `assets/kanji-radicard-data` | (chung) | 17 | 214 | ~89 KB | UTF-8 |
| `assets/reduplicative-words-data` | (chung) | 10 | 125 | ~26 KB | UTF-8 |
| `assets/list-music/playlist.json` | – | 1 | 7 tracks | 0.3 KB | UTF-8 (lỗi: "ESound Of...") |

**Tổng JSON dữ liệu nội dung: ~1.1 MB** (trừ list-music).

### 5.2. Cấu trúc từng loại JSON

```jsonc
// kanji-words-data/{N2,N3,N4}/lessonN.json — mỗi item:
{
  "kanji":   "雇",
  "amHan":   "Cố",
  "nghia":   "Thuê, tuyển dụng",
  "onyomi":  "コ",
  "kunyomi": "やと.う",
  "mnemonic": { "text": "..." },
  "examples": [
    { "word": "雇う", "reading": "やとう", "meaning": "thuê, mướn (người, xe)" },
    ...
  ]
}

// vocab-data/{N3,N4}/lessonN.json — mỗi item:
{
  "kanji":    "男性",
  "hiragana": "だんせい",
  "hanViet":  "NAM TÍNH",
  "meaning":  "đàn ông, nam giới"
}

// kanji-radicard-data/lessonN.json — mỗi item:
{
  "radical":        "一",
  "meaning":        "Nhất",
  "strokeCount":    1,
  "exampleKanji":   ["二", "三", "十"],
  "memoryTrick":    "Gạch ngang tượng trưng cho số một",
  "pronunciations": ["ichi", "itsu"],
  "explanation":    "Bộ thủ này biểu thị..."
}

// reduplicative-words-data/lessonN.json — mỗi item:
{
  "japanese":   "にこにこ",
  "romaji":     "nikoniko",
  "vietnamese": "tươi cười (cười mỉm, nét mặt rạng rỡ tươi tắn)",
  "category":   "Cảm xúc & Biểu cảm khuôn mặt"
}

// list-music/playlist.json
{ "tracks": ["Where Have You Gone.mp3", ...] }
```

### 5.3. Vấn đề dữ liệu quan trọng
- **BOM UTF-8** trong 46 file N2: cần loại bỏ hoặc HttpClient (đã hỗ trợ nếu server trả header đúng) vẫn parse được. Tuy nhiên khi đọc bằng `fetch`/`FileReader` thủ công có thể lỗi.
- **`kanji-words-data/N2` chỉ có 35 items** dù 48 file → nhiều file có thể rỗng `[]` hoặc trùng lặp.
- `playlist.json` có 1 entry bị lỗi đánh máy: `"ESound Of My Dream Remix.mp3"` (thừa chữ "E").
- **Không có file ngữ pháp** (`grammar-data/`). Đây là gap lớn nếu muốn AI hỏi đáp ngữ pháp.

---

## 6. Đánh giá khả năng tích hợp AI

### 6.1. Thuận lợi
1. **Dữ liệu JSON đã chuẩn hoá và đầy đủ**: 7 nhóm dữ liệu tiếng Nhật có cấu trúc rõ ràng, dễ index vào bộ nhớ cục bộ.
2. **Package `openai` đã có sẵn** trong `dependencies` nhưng chưa dùng → có thể tận dụng client SDK (mặc dù với Ollama thì không cần).
3. **Kiến trúc service-based đã có sẵn** (`MusicPlayerService`, `NumberJapaneseService`) → dễ bổ sung `AiService` cùng pattern.
4. **PWA + Service Worker + Prerender** giúp shell app load cực nhanh, dữ liệu JSON được cache 30 ngày (theo `ngsw-config.json`) → không cần backend cache.
5. **Angular Signals** đã được dùng → có thể reactive cập nhật UI khi nhận streaming token từ model.
6. **App là PWA + đã đóng gói Android qua Capacitor** → có thể chạy hoàn toàn offline + on-device nếu model Ollama chạy local.

### 6.2. Khó khăn
1. **Không có Backend**: Nếu gọi trực tiếp Ollama từ browser → sẽ bị CORS block. Phải:
   - (a) chạy Ollama với `OLLAMA_ORIGINS=*` và `OLLAMA_HOST=0.0.0.0`,
   - (b) hoặc dùng Service Worker proxy,
   - (c) hoặc chuyển sang dùng WebLLM (chạy model trong browser).
2. **Không có grammar data**: AI hỏi đáp ngữ pháp phải dựa vào model thuần, dễ bịa.
3. **CORS khi gọi Ollama**: Mặc định Ollama `127.0.0.1:11434` không cho phép cross-origin. Phải cấu hình lại.
4. **Streaming**: cần fetch API + ReadableStream + manual parse NDJSON, RxJS stream dài → UI phải dùng `signal.update()` liên tục.
5. **Browser memory**: Khi load toàn bộ JSON (~1.1 MB text) vào bộ nhớ để build context cho mỗi câu hỏi sẽ tốn nhưng chấp nhận được.
6. **BOM** trong file N2 có thể gây lỗi parse nếu dùng `fetch().text()` rồi `JSON.parse()`.

### 6.3. Rủi ro
1. **AI bịa đáp án**: Một model nhỏ (3B-7B) dễ tạo "fake Kanji" hoặc "fake radical". Cần phải ép model chỉ trả lời từ context (RAG) và validate bằng KnowledgeService.
2. **Ngôn ngữ prompt**: Model phải nhận diện được tiếng Việt + tiếng Nhật + romaji. Cần test kỹ.
3. **Rate-limit / Timeout**: Model cục bộ có thể chậm nếu user gửi nhiều câu liên tục.
4. **PWA cache cũ**: Khi deploy bản mới có AI, SW có thể cache asset cũ → cần bump version.
5. **Bundle size**: Nếu dùng WebLLM on-device (transformers.js + quantized model), bundle sẽ phình thêm vài trăm MB.
6. **Mobile Android (Capacitor)**: Chạy local model trên điện thoại rất khó, gần như bắt buộc phải có server bên ngoài hoặc model siêu nhỏ.

---

## 7. Thiết kế kiến trúc AI tối ưu

### 7.1. Mục tiêu
- **100% Frontend**, không Backend.
- Chạy model **`minimax-m3:cloud`** qua Hermes Agent (sub-agent) – hoặc fallback Ollama local.
- Hỏi đáp 4 lĩnh vực: **Kanji / Từ vựng / Bộ thủ / Ngữ pháp**.
- **RAG-first**: AI phải trả lời dựa trên JSON có sẵn trong `assets/`. Nếu JSON không có → nói "không có trong dữ liệu", KHÔNG bịa.

### 7.2. Hai lựa chọn kiến trúc

#### Lựa chọn A (khuyến nghị): RAG cục bộ + Hermes Agent như LLM
```
┌──────────────────────────────────────────────────────────┐
│                  Angular App (browser)                    │
│                                                          │
│  ┌────────────┐  prompt  ┌─────────────────────────────┐ │
│  │ User Chat  │ ───────► │ PromptBuilderService        │ │
│  └────────────┘          │  + KnowledgeService (RAG)   │ │
│                          └─────────────┬───────────────┘ │
│                                        │                 │
│                                        ▼                 │
│                          ┌──────────────────────────┐    │
│                          │ HermesAgentService       │    │
│                          │  (delegate_task)         │    │
│                          └─────────────┬────────────┘    │
│                                        │                 │
└────────────────────────────────────────┼────────────────┘
                                         ▼
                         ┌──────────────────────────────┐
                         │  Hermes Agent (host process) │
                         │   model: minimax-m3:cloud    │
                         │   trả lời với context JSON   │
                         └──────────────────────────────┘
```
- Ưu điểm: Không cần Ollama, không CORS, dùng chính model đang chat.
- Nhược điểm: Phải delegate qua `delegate_task` của Hermes từ browser → **KHÔNG KHẢ THI** vì `delegate_task` là tool của agent, không gọi được từ Angular runtime.

#### Lựa chọn B (khả thi duy nhất): Ollama local + CORS
```
┌──────────────────────────────────────────────────────────┐
│                  Angular App (browser)                    │
│                                                          │
│  ┌────────────┐                                          │
│  │ User Chat  │                                          │
│  └─────┬──────┘                                          │
│        ▼                                                 │
│  ┌─────────────────┐   build prompt                     │
│  │ PromptBuilder   │ ◄────── KnowledgeService           │
│  └─────────┬───────┘                                      │
│            ▼  fetch /api/chat (NDJSON stream)            │
│  ┌─────────────────┐                                      │
│  │ OllamaService   │  http://localhost:11434             │
│  │ (HTTP client)   │  model: minimax-m3:cloud?          │
│  └─────────┬───────┘  hoặc qwen2.5 / llama3.1 (3-7B)     │
└────────────┼──────────────────────────────────────────────┘
             ▼
   ┌────────────────────┐
   │ Ollama server      │
   │ (chạy ở máy user) │
   │ CORS: *            │
   └────────────────────┘
```

> **Ghi chú quan trọng:** Model `minimax-m3:cloud` không phải là model Ollama – đó là model **Hermes Agent**. Do đó cách duy nhất khả thi là **chạy model tương đương qua Ollama** (ví dụ `qwen2.5:7b`, `llama3.1:8b`, `mistral`, `gemma2`) hoặc **triển khai một microservice proxy nhỏ** (Express + 1 endpoint) trong chính `src/server.ts` hiện có để forward request tới Ollama/Hermes – vẫn nằm trong cùng bundle SSR, không cần backend riêng.

### 7.3. Kiến trúc được chọn: **RAG cục bộ + Proxy SSR + Ollama**
Tận dụng **Express server trong `src/server.ts`** (đã có sẵn cho SSR) làm proxy → browser gọi `/api/ai/chat` cùng origin → không CORS → Express forward sang Ollama.

```
[Browser] ──/api/ai/chat──► [Express SSR :4000] ──► [Ollama :11434]
                                  │
                                  └── đính kèm context RAG
```

### 7.4. Pipeline RAG
1. **Load tất cả JSON lúc bootstrap app** (KnowledgeService → Signal state).
2. **Build search index** đơn giản (lowercase substring match + scoring).
3. Khi user hỏi:
   a. Phân loại câu hỏi (kanji/vocab/radical/grammar) → chọn nguồn dữ liệu ưu tiên.
   b. Search top-K (K=5) item liên quan trong JSON.
   c. Prompt = `system + context(JSON snippet) + userQuestion`.
   d. Gửi tới Ollama, stream về browser.
   e. Validate: nếu model trả "Tôi không biết" → không bịa. Nếu model trả item cụ thể → so khớp với KnowledgeService để đảm bảo tồn tại trong JSON.
4. **Cache câu hỏi + câu trả lời** trong localStorage (CacheService) để tránh gọi lại.

---

## 8. Thiết kế module / component / service mới

### 8.1. Module mới

| Module | Vai trò |
|---|---|
| `AiModule` | Module cha, lazy load, khai báo route `/ai-assistant`, `/ai-debug`. |
| (Optional) `AiChatWidgetModule` | Có thể lazy load riêng để giảm bundle ban đầu. |

### 8.2. Component mới

| Component | Selector | Vai trò |
|---|---|---|
| `AiAssistantComponent` | `app-ai-assistant` | Container: chat UI, danh sách gợi ý, debug panel. |
| `AiChatBubbleComponent` | `app-ai-chat-bubble` | Bong bóng chat user/assistant, có hiệu ứng typing cho streaming. |
| `AiSuggestionChipsComponent` | `app-ai-suggestions` | Nút gợi ý câu hỏi nhanh: "Cho ví dụ về kanji 食", "Ngữ pháp ～たら", ... |
| `AiContextPreviewComponent` | `app-ai-context` | Hiển thị (tuỳ chọn) cho user thấy context JSON nào đang được gửi kèm (minh bạch RAG). |
| `AiSettingsComponent` | `app-ai-settings` | Cấu hình endpoint Ollama, model, temperature, top-K. |

### 8.3. Service mới

| Service | File đề xuất | Nhiệm vụ |
|---|---|---|
| **KnowledgeService** | `app/ai/services/knowledge.service.ts` | Load + cache toàn bộ JSON, build inverted-index, cung cấp `search(query, category, topK)`. |
| **SearchEngineService** | `app/ai/services/search-engine.service.ts` | Scoring theo TF + exact match + field priority (kanji > hiragana > meaning). |
| **PromptBuilderService** | `app/ai/services/prompt-builder.service.ts` | Soạn system prompt cứng (tiếng Việt + Nhật) + chèn context RAG + ghép user question. |
| **OllamaService** | `app/ai/services/ollama.service.ts` | Gọi `POST /api/chat` với NDJSON streaming, parse từng token, đẩy vào Subject/Signal. |
| **AiService** | `app/ai/services/ai.service.ts` | Orchestrator: phân loại câu hỏi → gọi KnowledgeService → PromptBuilder → OllamaService → validate. |
| **CacheService** | `app/ai/services/cache.service.ts` | localStorage wrapper, TTL, LRU max 100 entries. |
| **AiHistoryService** | `app/ai/services/ai-history.service.ts` | Lưu lịch sử chat (IndexedDB nếu lớn). |
| **AiSettingsService** | `app/ai/services/ai-settings.service.ts` | Cấu hình user: endpoint, model, ngôn ngữ, topK. |

### 8.4. Model / Interface mới

```ts
// app/ai/models/knowledge.model.ts
export type KnowledgeDomain = 'kanji-word' | 'vocab' | 'radical' | 'reduplicative' | 'grammar';

export interface KnowledgeItem {
  domain: KnowledgeDomain;
  id: string;            // hash của primary key
  raw: unknown;          // bản gốc từ JSON
  searchTokens: string[];// đã normalize để search nhanh
  level?: 'N2'|'N3'|'N4';
  lessonNumber?: number;
}

// app/ai/models/prompt.model.ts
export interface PromptContext {
  domain: KnowledgeDomain;
  items: KnowledgeItem[];  // top-K items
  summary: string;         // tóm tắt ngắn cho model
}

export interface PromptTemplate {
  system: string;
  userTemplate: (ctx: PromptContext, question: string) => string;
}

// app/ai/models/ai-chat.model.ts
export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  contextUsed?: PromptContext;
  sourceCitations?: string[];  // id của KnowledgeItem được tham chiếu
}

export interface AiChatSession {
  id: string;
  startedAt: number;
  messages: AiChatMessage[];
}

export interface AiSettings {
  ollamaEndpoint: string;       // mặc định 'http://localhost:11434'
  model: string;                // mặc định 'qwen2.5:7b'
  temperature: number;          // 0.0 - 1.0
  topK: number;                 // 3-10
  language: 'vi' | 'en' | 'ja';
  enableStreaming: boolean;
  maxContextChars: number;      // giới hạn context gửi cho model
}

// app/ai/models/stream-event.model.ts
export interface OllamaStreamEvent {
  model: string;
  created_at: string;
  response?: string;            // token mới
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}
```

### 8.5. Utility mới

| Utility | File | Vai trò |
|---|---|---|
| `tokenizer.util.ts` | `app/ai/utils/` | Tách romaji, hiragana, katakana, kanji. Loại bỏ dấu câu. |
| `romanize.util.ts` | `app/ai/utils/` | Hỗ trợ so sánh romaji ↔ hiragana (dùng WanakanaJS). |
| `text-similarity.util.ts` | `app/ai/utils/` | Levenshtein + Jaro-Winkler + substring scoring. |
| `string-normalize.util.ts` | `app/ai/utils/` | lowercase, bỏ dấu TV, bỏ khoảng trắng. |
| `response-validator.util.ts` | `app/ai/utils/` | Kiểm tra câu trả lời có chứa token không tồn tại trong KnowledgeService → đánh dấu "hallucinated". |
| `abortable-stream.util.ts` | `app/ai/utils/` | Wrapper `fetch` + `AbortController` + NDJSON parser. |

### 8.6. Cập nhật SSR proxy (`src/server.ts`)

Bổ sung endpoint `/api/ai/chat` (POST) forward tới Ollama, có streaming passthrough, đính kèm context RAG nếu client gửi `domain + query`.

### 8.7. Routes & menu

| Path | Component | Ghi chú |
|---|---|---|
| `/ai-assistant` | `AiAssistantComponent` | Lazy load |
| `/ai-settings` | `AiSettingsComponent` | Lazy load |

Bổ sung thẻ menu thứ 6 trong Home: `path: '/ai-assistant'`, icon `🤖`, gradient xanh dương.

### 8.8. Cảnh báo quan trọng về package `openai`
Trong `package.json` có `openai ^4.86.1`. Nếu quyết định KHÔNG dùng cloud OpenAI, nên **xoá khỏi dependencies** để giảm install time. Nếu muốn dự phòng Ollama-down → fallback cloud → giữ nhưng isolate trong `AiService` qua interface `LlmBackend`.

---

## 9. Lập TODO theo phase

### Phase 1 — BẮT BUỘC (MVP "AI có thể trả lời đúng dữ liệu JSON")

| # | Task | Mục đích |
|---|---|---|
| 1.1 | Tạo folder `src/app/ai/` với cấu trúc models / services / utils / components. | Tổ chức code mới tách bạch. |
| 1.2 | Tạo `KnowledgeService` load toàn bộ JSON một lần lúc bootstrap, expose `search()`. | Nguồn dữ liệu cho RAG. |
| 1.3 | Tạo `PromptBuilderService` với 4 template (kanji / vocab / radical / grammar) + system prompt chống bịa. | Prompt RAG chuẩn. |
| 1.4 | Tạo `OllamaService` gọi `POST /api/chat` stream NDJSON. | Kết nối model. |
| 1.5 | Tạo `AiService` orchestrator, phân loại câu hỏi bằng keyword + fallback domain detection. | Bộ não điều phối. |
| 1.6 | Tạo `AiAssistantComponent` + `AiChatBubbleComponent` với signal-based streaming. | UI chat cơ bản. |
| 1.7 | Thêm route `/ai-assistant` lazy load. | Điểm vào. |
| 1.8 | Bổ sung endpoint `/api/ai/chat` trong `src/server.ts` (proxy sang Ollama). | Bypass CORS. |
| 1.9 | Thêm menu card "🤖 Trợ lý AI" vào `home.component.ts`. | Khám phá. |
| 1.10 | Validate output: nếu câu trả lời chứa token không có trong KnowledgeService → gắn cờ "có thể không chính xác". | Chống bịa. |
| 1.11 | Sửa ngay BOM UTF-8 của 46 file N2 (chạy 1 script `utf8-sig → utf-8`). | Tránh lỗi parse. |
| 1.12 | Sửa lỗi đánh máy playlist.json (`"ESound Of..."` → `"Sound Of..."`). | Vệ sinh dữ liệu. |

**Tiêu chí hoàn thành Phase 1:**
- Hỏi "Kanji 食 nghĩa là gì?" → trả lời đúng + cite được từ `kanji-words-data/...json`.
- Hỏi "Bộ thủ 艹 có nghĩa gì?" → trả lời đúng.
- Hỏi "Câu 'おはようございます' nghĩa là gì?" → trả lời đúng từ `vocab-data`.
- Hỏi "Ngữ pháp ～たら" → model trả lời + disclaimer "Không có trong dữ liệu JSON, dựa trên kiến thức model".

### Phase 2 — NÂNG CAO (UX + ngữ pháp + lịch sử)

| # | Task |
|---|---|
| 2.1 | `AiHistoryService` lưu IndexedDB, cho phép xem lại các phiên chat. |
| 2.2 | `AiSettingsComponent` + `AiSettingsService` cho phép đổi model / endpoint / temperature. |
| 2.3 | `AiSuggestionChipsComponent` gợi ý 6-10 câu hỏi mẫu theo từng domain. |
| 2.4 | `AiContextPreviewComponent` toggle hiển thị context gửi kèm (minh bạch RAG). |
| 2.5 | Streaming UX: hiệu ứng typing dots, cancel button (AbortController). |
| 2.6 | Markdown mini-parser trong `AiChatBubbleComponent` (hỗ trợ in đậm, code, list ngắn). |
| 2.7 | Bổ sung `grammar-data/` JSON (nếu user cung cấp) + mở rộng KnowledgeService. |
| 2.8 | Fallback provider: nếu Ollama fail → gọi OpenAI cloud (giữ package `openai`). |
| 2.9 | Bổ sung `MarkdownPipe` để hiển thị trường `explanation` của radical, `examples` của kanji word có format đẹp hơn. |
| 2.10 | Bổ sung `pronunciationHelper` cho AI: tự động đọc từ vựng/kanji liên quan khi user click vào chat bubble. |

### Phase 3 — TỐI ƯU (production-ready)

| # | Task |
|---|---|
| 3.1 | `CacheService` với TTL 7 ngày cho mỗi câu hỏi giống nhau → giảm tải Ollama. |
| 3.2 | Dùng **Web Worker** để parse JSON và search index, không block UI thread. |
| 3.3 | Preload knowledge index vào Service Worker cache. |
| 3.4 | A/B test prompt templates, log đánh giá hữu ích của user. |
| 3.5 | Tối ưu context window: chỉ gửi trường cần thiết (kanji + nghia + 2 examples). |
| 3.6 | Thêm test (Karma) cho KnowledgeService, PromptBuilderService. |
| 3.7 | Thêm Cypress e2e test luồng chat. |
| 3.8 | Telemetry: đếm số token, thời gian phản hồi, tỉ lệ trả lời đúng → in dashboard. |
| 3.9 | Triển khai **WebLLM** (transformers.js) như provider dự phòng khi offline. |
| 3.10 | Tích hợp vào `app.component.html` dưới dạng floating widget (như MusicPlayer). |

---

## 10. Ước lượng độ khó & thời gian

Đơn vị: **giờ làm việc của 1 Senior Angular + 1 AI Engineer**, giả định đã quen stack.

### Phase 1 (MVP)
| Task | Độ khó | Thời gian |
|---|---|---|
| 1.1 Tạo folder + skeleton | Easy | 0.5h |
| 1.2 KnowledgeService | Medium | 3h |
| 1.3 PromptBuilderService | Medium | 2h |
| 1.4 OllamaService (streaming) | **Hard** | 4h |
| 1.5 AiService orchestrator | Medium | 3h |
| 1.6 UI chat components | Medium | 4h |
| 1.7 Route lazy load | Easy | 0.5h |
| 1.8 SSR proxy endpoint | Medium | 2h |
| 1.9 Menu integration | Easy | 0.5h |
| 1.10 Validator chống bịa | **Hard** | 3h |
| 1.11 Sửa BOM 46 file N2 | Easy (script) | 0.5h |
| 1.12 Sửa playlist.json | Trivial | 0.1h |
| **Tổng Phase 1** | – | **~23h (≈3 ngày)** |

### Phase 2 (Nâng cao)
| Task | Độ khó | Thời gian |
|---|---|---|
| 2.1 AiHistoryService (IndexedDB) | Medium | 3h |
| 2.2 AiSettings | Easy | 2h |
| 2.3 Suggestion chips | Easy | 1.5h |
| 2.4 Context preview | Easy | 1.5h |
| 2.5 Streaming UX + Abort | Medium | 2h |
| 2.6 Markdown mini-parser | Medium | 3h |
| 2.7 grammar-data | Medium (nếu có data) | 4h |
| 2.8 Fallback OpenAI | Medium | 3h |
| 2.9 MarkdownPipe cho kanji explanation | Easy | 1h |
| 2.10 pronunciationHelper | Medium | 2h |
| **Tổng Phase 2** | – | **~23h (≈3 ngày)** |

### Phase 3 (Tối ưu)
| Task | Độ khó | Thời gian |
|---|---|---|
| 3.1 CacheService TTL | Medium | 2h |
| 3.2 Web Worker | **Hard** | 6h |
| 3.3 SW pre-cache index | Medium | 3h |
| 3.4 A/B prompt | Easy | 2h |
| 3.5 Context optimization | Medium | 3h |
| 3.6 Karma tests | Medium | 4h |
| 3.7 Cypress e2e | Medium | 4h |
| 3.8 Telemetry | Medium | 4h |
| 3.9 WebLLM fallback | **Hard** | 8h |
| 3.10 Floating widget | Easy | 2h |
| **Tổng Phase 3** | – | **~38h (≈5 ngày)** |

**Tổng toàn bộ: ~84h ≈ 11 ngày làm việc** (1 dev) hoặc **~6 ngày** (2 dev song song).

---

## 11. Phụ lục: Vấn đề kỹ thuật hiện tại

> Các vấn đề KHÔNG liên quan AI nhưng phát hiện khi đọc source, đáng chú ý:

1. **BOM UTF-8** trong 46/48 file `kanji-words-data/N2/lesson*.json`. Khi đọc bằng `fetch().text()` thủ công hoặc nhúng vào build có thể parse lỗi nếu HttpClient không strip BOM. → Sửa bằng script chuyển sang UTF-8 không BOM.
2. **`kanji-words-data/N2` chỉ có 35 items** dù 48 file. Có thể nhiều file rỗng `[]`. Cần audit.
3. **Lỗi đánh máy trong `assets/list-music/playlist.json`**: `"ESound Of My Dream Remix.mp3"` (thừa chữ "E"). MusicPlayerService sẽ không tìm thấy file → lỗi im lặng.
4. **Route `/adverb-radicals` không tồn tại** trong `app-routing.module.ts`. Menu home click vào sẽ redirect `/home` (do wildcard `**`). `AdverbComponent` chỉ render `<p>adverb works!</p>`.
5. **`MusicPlayerComponent` bị comment** trong `app.component.html`: `<!-- <app-music-player></app-music-player> -->` → music player hiện không hiển thị.
6. **`numberPractice` không wire route** trong `app-routing.module.ts` mặc dù có routing module riêng.
7. **Trùng lặp `KanjiWord` và `Example` interface** giữa flashcard và quiz trong `kanjiWords`. Nên tách ra `models/`.
8. **HTTP `cache-buster = Date.now()`** trong `layout-kanji-words` và `layout-reduplicative-words`: bypass HTTP cache, mỗi request đều fetch fresh → tốn băng thông + chậm. Đã có Service Worker dataGroup cache rồi nhưng code bypass.
9. **Bundle JSON vào trong `localStorage`**: với 22 lesson vocab N3 (~92 KB), 48 lesson kanji N2 (~38 KB) thì OK; nhưng với N3 + N4 kanji (~580 KB) có thể gần đầy quota 5 MB.
10. **`openai` package** khai báo nhưng không dùng → install thừa ~5 MB.
11. **Thiếu folder `environments/`**: không có `environment.ts` / `environment.prod.ts` để quản lý config. Endpoint AI và feature flag đều phải hard-code hoặc dùng DI token.
12. **`AdverbComponent` trong declarations của `AppModule`** nhưng không có route riêng → không thể dùng.
13. **`tsconfig.app.json` chỉ include `*.d.ts`**, không `include` thư mục `app/` → có thể là convention Angular 19 application builder (esbuild-based) nhưng cần verify build pass.
14. **Không có ESLint/Prettier config** → code style không đồng nhất giữa các nhánh (đặt tên lẫn lộn `layout-Vocabulary` vs `layoutKanjiRadicals`, v.v.).

---

> **Kết thúc báo cáo.** File này lưu tại `H:\Scripts\japanese-vocab-app\AI_ARCHITECTURE_REVIEW.md`.
> Bước tiếp theo: chờ user phê duyệt phương án (RAG cục bộ + SSR proxy + Ollama), sau đó mới bắt đầu code theo Phase 1.