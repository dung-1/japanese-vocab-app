# Japanese Vocabulary App - Complete Project Analysis

**Analysis Date:** 2025-09-08  
**Repository:** dung-1/japanese-vocab-app  
**Commit:** 9de03ee9b7c1ac885770a0605adb670f711546f9  
**Status:** Analysis Phase Only (No Code Changes)

---

## 1. Project Overview

The Japanese Vocabulary App is an AI-powered ecosystem designed for **JLPT (Japanese Language Proficiency Test) learning**, specifically targeting N2, N3, and N4 levels.

### Key Characteristics
- **Primary Focus:** Vocabulary, Grammar, Kanji, Radicals, and Reduplicative Words (N3+ levels)
- **UI Framework:** Angular 19 with Server-Side Rendering (SSR)
- **AI Integration:** Local (Ollama) and Cloud (OpenAI/Nemotron) providers
- **Backend:** Supabase (PostgreSQL, Authentication, Real-time)
- **Deployment:** Vercel (Edge Functions support)
- **Target Platforms:** Web (browser) and Android (via Capacitor)
- **PWA:** Fully configured with Service Worker

### Main Modules
1. **Home** - Landing page with navigation
2. **Vocabulary** - N2, N3, N4 word learning
3. **Grammar** - Pattern-based grammar lessons (N3 = 30 lessons)
4. **Kanji Words** - Kanji writing with readings and meanings
5. **Kanji Radicals** - Radical component learning
6. **Reduplicative Words** - Onomatopoeia and duplicated words
7. **Catholic** - Unknown domain (requires investigation)
8. **Adverb** - Adverb learning module
9. **AI Assistant** - Chat-based tutoring system
10. **Music Player** - Background music during study

---

## 2. Technology Stack

### Frontend
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Angular | 19.0.0 |
| Language | TypeScript | 5.6.2 |
| Rendering | @angular/ssr | 19.0.6 |
| HTTP Client | @angular/common/http | 19.0.0 |
| Forms | @angular/forms | 19.0.0 |
| Router | @angular/router | 19.0.0 |
| PWA Support | @angular/service-worker | 19.0.0 |
| State Management | Signals API (built-in) | Native |
| RxJS | RxJS | 7.8.0 |

### Backend & APIs
| Component | Service | Version |
|-----------|---------|---------|
| Database | Supabase (PostgreSQL) | 2.40.0 |
| Authentication | Supabase Auth | Built-in |
| Chat API | Ollama / OpenAI | Local/Cloud |
| Server Framework | Express.js | 4.18.2 |
| Serverless | Vercel Edge Functions | N/A |

### Mobile
| Component | Technology | Version |
|-----------|-----------|---------|
| Native Wrapper | Capacitor | 7.1.0 |
| CLI | @capacitor/cli | 7.1.0 |
| Android Runtime | @capacitor/android | 7.1.0 |

### Build & Deployment
| Tool | Version | Purpose |
|------|---------|---------|
| Angular CLI | 19.0.6 | Build & dev server |
| Build Tool | @angular-devkit | 19.0.6 |
| Vercel | Deploy | SSR hosting |
| Node.js | 18+ | Runtime |
| npm | 9+ | Package manager |

### Testing
| Framework | Version | Status |
|-----------|---------|--------|
| Jasmine | 5.4.0 | Configured |
| Karma | 6.4.0 | Configured |
| Karma Chrome Launcher | 3.2.0 | Configured |

---

## 3. Current Architecture

### 3.1 Component Hierarchy

```
AppComponent (root)
├── AppModule (NgModule-based)
├── AppRoutingModule
│   ├── HomeComponent
│   ├── LayoutVocabularyComponentModule (lazy)
│   ├── LayoutGrammarModule (lazy)
│   ├── LayoutkanjiRadicalsModule (lazy)
│   ├── LayoutKanjiWordsModule (lazy)
│   ├── LayoutReduplicativeWordsModule (lazy)
│   ├── LayoutCatholicComponentModule (lazy)
│   └── AiModule (lazy)
│       ├── AiAssistantComponent
│       ├── AiChatBubbleComponent
│       ├── AiSettingsComponent
│       ├── SlashCommandMenuComponent
│       └── ChatHistorySidebarComponent
└── MusicPlayerComponent (standalone)
```

### 3.2 Module Architecture Pattern

- **NgModule-based:** All modules use `@NgModule()` decorator (NOT standalone components)
- **Lazy Loading:** Feature modules are lazy-loaded via `loadChildren`
- **Shared Services:** Provided at root level via `providedIn: 'root'`
- **Standalone Components:** Only `MusicPlayerComponent` is standalone

### 3.3 Architectural Layers

#### Presentation Layer
- Components with `.component.ts`, `.component.html`, `.component.css` triplets
- Form bindings via `FormsModule`
- Router-driven navigation

#### Service Layer
- **AI Services:** `AiService`, `OllamaService`, `PromptBuilderService`, `EnhancedPromptBuilderService`
- **Knowledge Services:** `KnowledgeService`, `SearchEngineService`, `EmbeddingService`
- **Grammar Services:** `GrammarService`
- **Backend Services:** `SupabaseChatService`
- **Utilities:** `MusicPlayerService`

#### Data Layer
- **Local Storage:** Caching for JSON data and grammar lessons
- **Supabase (Cloud):** Chat sessions and messages (device-based RLS)
- **Static JSON Assets:** Vocabulary, Grammar, Kanji data

---

## 4. Angular Configuration

### 4.1 TypeScript Configuration

**Strict Mode: YES (Full Strict)**
```json
{
  "strict": true,
  "noImplicitOverride": true,
  "noPropertyAccessFromIndexSignature": true,
  "noImplicitReturns": true,
  "noFalltallCasesInSwitch": true,
  "strictInjectionParameters": true,
  "strictInputAccessModifiers": true,
  "strictTemplates": true
}
```

**Target:** ES2022  
**Module:** ES2022

### 4.2 Build Configuration

**angular.json Key Settings:**
- **Dev Server Port:** 3001
- **Host:** 192.168.31.93
- **SSR Entry:** `src/server.ts`
- **Output Mode:** server (SSR enabled)
- **Bundle Budget:** 1MB max (initial + component styles)
- **Service Worker:** Enabled in production only
- **Output Hashing:** All assets

### 4.3 TypeScript Compiler Options

**For API Layer (api/tsconfig.json):**
- Module: CommonJS
- Target: ES2020
- Resolution: node

---

## 5. Routing Structure

### 5.1 Route Configuration

| Path | Component | Load | Strategy |
|------|-----------|------|----------|
| `/` | Redirect | N/A | Redirect to `/home` |
| `/home` | HomeComponent | Direct | Eager |
| `/vocabulary` | LayoutVocabularyComponentModule | Lazy | On demand |
| `/grammar` | LayoutGrammarModule | Lazy | On demand |
| `/kanji-radicals` | LayoutkanjiRadicalsModule | Lazy | On demand |
| `/kanji-words` | LayoutKanjiWordsModule | Lazy | On demand |
| `/reduplicative-words` | LayoutReduplicativeWordsModule | Lazy | On demand |
| `/catholic` | LayoutCatholicComponentModule | Lazy | On demand |
| `/ai` | AiModule | Lazy | On demand |
| `**` | Wildcard | N/A | Redirect to `/home` |

### 5.2 Feature Module Routing

Each feature module (e.g., `LayoutGrammarModule`) has its own **routing module** defined within `layout-grammar/layout-grammar-routing.module.ts`.

---

## 6. Existing Data Models

### 6.1 Knowledge Domain Model

**File:** `src/app/ai/models/knowledge.model.ts`

```typescript
type KnowledgeDomain = 'kanji-word' | 'vocab' | 'radical' | 'reduplicative' | 'grammar';

interface KnowledgeItem {
  domain: KnowledgeDomain;
  id: string;
  level?: 'N2' | 'N3' | 'N4';
  lessonNumber?: number;
  primary: string;
  raw: KanjiWordRaw | VocabRaw | KanjiRadicalRaw | ReduplicativeRaw | Record<string, unknown>;
  searchTokens: string[];
}
```

### 6.2 Grammar Model

**File:** `src/app/grammar/models/grammar.model.ts`

```typescript
interface GrammarItem {
  id: string;
  domain: 'grammar';
  pattern: string;                    // e.g., "～さえ･･･ば"
  meaning: string;                    // Vietnamese explanation
  connection: GrammarConnection;      // Formula and note
  core_nuance: string;                // Core meaning
  mnemonic: GrammarMnemonic;          // Memory aid
  examples: GrammarExample[];         // 2-3 examples
  ai_ollama_prompt_hint: string;      // AI prompt guide
}

interface GrammarQuizQuestion {
  id: string;
  type: 'meaning-to-pattern' | 'pattern-to-meaning' | 'fill-blank' | 'formula-check' | 'example-match';
  question: string;
  correctAnswer: string;
  options: string[];
  grammarItem: GrammarItem;
}
```

### 6.3 AI Chat Model

**File:** `src/app/ai/models/ai-chat.model.ts`

```typescript
interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  contextUsed?: PromptContext;
  sourceCitations?: string[];
  streaming?: boolean;
  error?: string;
}

interface AiSettings {
  provider: 'local' | 'cloud';
  model: string;
  temperature: number;
  topK: number;
  language: 'vi' | 'en' | 'ja';
  streaming: boolean;
  maxContextChars: number;
  enabled: boolean;
}
```

### 6.4 Supabase Chat Service Model

**File:** `src/app/ai/services/supabase-chat.service.ts`

```typescript
interface DbSession {
  id: string;
  device_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface DbMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  context_domain?: string;
  context_items?: number;
}
```

---

## 7. JLPT JSON Data Analysis

### 7.1 Data File Organization

**Manifest File:** `src/assets/ai/manifest.json`
```json
{
  "files": [
    { "domain": "kanji-word", "level": "N3", "path": "assets/kanji-words-data/N3/lesson{1-30}.json" },
    { "domain": "kanji-word", "level": "N4", "path": "assets/kanji-words-data/N4/lesson{1-26}.json" },
    { "domain": "kanji-word", "level": "N2", "path": "assets/kanji-words-data/N2/lesson{1-48}.json" },
    { "domain": "vocab", "level": "N2", "path": "assets/vocab-data/N2/lesson{1-24}.json" },
    { "domain": "vocab", "level": "N3", "path": "assets/vocab-data/N3/lesson{1-22}.json" },
    { "domain": "vocab", "level": "N4", "path": "assets/vocab-data/N4/lesson{1-25}.json" },
    { "domain": "radical", "path": "assets/kanji-radicard-data/lesson{1-17}.json" },
    { "domain": "reduplicative", "path": "assets/reduplicative-words-data/lesson{1-10}.json" }
  ]
}
```

### 7.2 Grammar Data

**Location:** `src/assets/grammar/N3/lessonX.json` (where X = 1 to at least 19)

**File Format:** JSON array

**Record Structure:**
```json
{
  "pattern": "～さえ･･･ば",
  "meaning": "Chỉ cần... thì (là điều kiện duy nhất cần thiết)",
  "connection": {
    "formula": "N + さえ ･･･ Vば / Aければ / Naなら / Nなら",
    "note": "Diễn tả ý chỉ cần thỏa mãn được điều kiện tối thiểu này..."
  },
  "core_nuance": "Nhấn mạnh vào một điều kiện cốt lõi độc nhất...",
  "mnemonic": {
    "concept": "Chìa khóa vạn năng",
    "kanji_link": "さえ (Ngay cả/Thậm chí) + ば (Nếu).",
    "story": "Ngay cả (さえ) một điều nhỏ nhoi này nếu (ば) được đáp ứng..."
  },
  "examples": [
    {
      "japanese": "時間さえあれば、遠くまで行けるのに。",
      "romaji": "Jikan sae areba, tōku made ikeru noni.",
      "vietnamese": "Chỉ cần có thời gian thôi...",
      "highlight_keyword": "時間さえあれば"
    }
  ],
  "ai_ollama_prompt_hint": "Viết câu khích lệ: Chỉ cần bạn không bỏ cuộc..."
}
```

**Data Quality Issues Detected:**
- ✅ Consistent structure across files
- ✅ Vietnamese explanations present
- ✅ Japanese examples with romaji
- ⚠️ No unique IDs field (relies on array index + filename)
- ✅ Mnemonic aids for memory
- ✅ AI prompt hints for tutor generation

**Estimated Coverage:**
- N3: At least 30 lessons (based on hardcoded rule)
- Records per lesson: ~1-2 grammar patterns per file

### 7.3 Vocabulary Data

**Location:** `src/assets/vocab-data/{N2|N3|N4}/lessonX.json`

**File Format:** JSON array

**Record Structure:**
```json
{
  "kanji": "河川",
  "hiragana": "かせん",
  "hanViet": "HÀ XUYÊN",
  "meaning": "sông ngòi"
}
```

**Data Quality Assessment:**
- ✅ Simple, flat structure
- ✅ Kanji, hiragana, Han-Viet, and Vietnamese meaning
- ✅ Consistent across N2, N3, N4 levels
- ⚠️ No unique ID field
- ⚠️ No example sentences
- ⚠️ No usage context

**Coverage:**
- **N2:** 24 lessons
- **N3:** 22 lessons
- **N4:** 25 lessons
- **Estimated records:** ~50-100 words per lesson

### 7.4 Kanji Words Data

**Location:** `src/assets/kanji-words-data/{N2|N3|N4}/lessonX.json`

**File Format:** JSON array

**Record Structure:**
```json
{
  "kanji": "較",
  "amHan": "Khảo / Giác",
  "nghia": "So sánh",
  "onyomi": "カク、コウ",
  "kunyomi": "くら.べる",
  "mnemonic": {
    "text": "Hai chiếc XE (車) GIAO (交) nhau trên đường để SO SÁNH..."
  },
  "examples": [
    {
      "word": "比較",
      "reading": "ひかく",
      "meaning": "so sánh, đối chiếu"
    }
  ]
}
```

**Data Quality Assessment:**
- ✅ Rich structure with readings (On'yomi, Kun'yomi)
- ✅ Mnemonic stories for memorization
- ✅ 5+ examples per kanji
- ✅ Han-Viet readings
- ✅ Consistent across levels
- ⚠️ No unique ID field

**Coverage:**
- **N2:** 48 lessons
- **N3:** 30 lessons
- **N4:** 26 lessons
- **Estimated records:** ~5-10 kanji per lesson

### 7.5 Kanji Radicals Data

**Location:** `src/assets/kanji-radicard-data/lessonX.json` (X = 1 to 17)

**File Format:** JSON array

**Record Structure:**
```json
{
  "radical": "金",
  "meaning": "Kim",
  "strokeCount": 8,
  "exampleKanji": ["銀", "銅", "鉄"],
  "memoryTrick": "Kim loại, vàng",
  "pronunciations": ["kin", "kon"],
  "explanation": "Bộ thủ này biểu thị 'kim loại'..."
}
```

**Data Quality Assessment:**
- ✅ Complete radical component data
- ✅ Example kanji using each radical
- ✅ Stroke count information
- ✅ Vietnamese and Japanese explanations
- ✅ Consistent structure

**Coverage:**
- **Total Lessons:** 17
- **Estimated records:** ~3-5 radicals per lesson

### 7.6 Reduplicative Words Data

**Location:** `src/assets/reduplicative-words-data/lessonX.json` (X = 1 to 10)

**File Format:** JSON array

**Record Structure:**
```json
{
  "japanese": "ぽたぽた",
  "romaji": "potapota",
  "vietnamese": "một giọt một giọt, từng giọt",
  "category": "onomatopoeia"
}
```

**Data Quality Assessment:**
- ✅ Simple, focused structure
- ✅ Category information
- ✅ Romaji transliteration
- ✅ Vietnamese meanings

**Coverage:**
- **Total Lessons:** 10
- **Estimated records:** ~20-30 words per lesson

---

## 8. Existing Backend / Supabase Integration

### 8.1 Supabase Configuration

**File:** `src/environments/environment.ts` and `environment.prod.ts`

```typescript
supabase: { 
  url: 'https://gmvoxzysoixvwdvyvkht.supabase.co',
  anonKey: 'sb_publishable_XvlZTGo-1AWiI_GkwEy2HQ_NJRxdjgy'
}
```

**Status:** ✅ **ALREADY CONFIGURED AND INTEGRATED**

### 8.2 Database Schema (Inferred from Code)

**Tables Detected:**

1. **chat_sessions**
   - `id: UUID`
   - `device_id: UUID`
   - `title: string`
   - `created_at: timestamp`
   - `updated_at: timestamp`
   - **RLS Policy:** Based on `device_id` (via custom header `x-device-id`)

2. **chat_messages**
   - `id: UUID`
   - `session_id: UUID`
   - `role: 'user' | 'assistant'`
   - `content: text`
   - `created_at: timestamp`
   - `context_domain?: string`
   - `context_items?: number`

### 8.3 Authentication

**Current State:**
- ✅ Supabase client initialized: `@supabase/supabase-js@2.40.0`
- ✅ Device-based session tracking (no user login required)
- ✅ Custom device ID generation and storage in localStorage
- ✅ RLS policies configured for device-based access

**File:** `src/app/ai/services/supabase-chat.service.ts`

### 8.4 Known Issues

**BUG-001 (Fixed):** Custom header `x-device-id` must be sent to satisfy RLS policies based on PostgreSQL `current_setting('request.headers', true)`.

---

## 9. PWA Status

### 9.1 Configuration Status

**✅ FULLY CONFIGURED AS PWA**

### 9.2 Service Worker Config

**File:** `ngsw-config.json`

**Features Enabled:**
1. **Asset Caching:**
   - App shell (HTML, CSS, JS) - Prefetch
   - Static assets - Lazy load + prefetch

2. **Data Group Caching:**
   - Vocabulary data: Performance strategy, 5MB, 30 days
   - AI/Kanji data: Performance strategy, 5MB, 30 days
   - Chat API: Freshness strategy, 1 day
   - External images (Pexels): Freshness strategy, 10MB, 30 days

3. **Service Worker Registration:**
   - Enabled in production only (`!isDevMode()`)
   - Registration strategy: `registerWhenStable:30000`

### 9.3 Manifest Configuration

**File:** `public/manifest.webmanifest`

- **Display Mode:** Standalone
- **Theme Color:** #1976d2
- **Background Color:** #fafafa
- **Icons:** 8 sizes (72x72 to 512x512) with maskable support
- **Start URL:** ./

### 9.4 PWA Capabilities

- ✅ Offline-first data caching
- ✅ Background sync ready
- ✅ Installable on desktop and mobile
- ✅ Standalone display mode

---

## 10. Testing Status

### 10.1 Test Framework

**Configured:**
- ✅ Jasmine (5.4.0)
- ✅ Karma (6.4.0)
- ✅ Karma Chrome Launcher (3.2.0)
- ✅ Karma Coverage (2.2.0)

**TypeScript Config:** `tsconfig.spec.json`

### 10.2 Test Commands

```bash
npm run test          # Run tests in watch mode
npm run test:ci       # CI mode (not in package.json)
```

### 10.3 Test Files

**Pattern:** `src/**/*.spec.ts`

**Actual Test Coverage:** Not found in repository (no .spec.ts files detected)

**Status:** ⚠️ **Testing infrastructure is configured but NO TESTS WRITTEN**

---

## 11. Reusable Existing Code

### 11.1 Core Services (Highly Reusable)

#### Knowledge Management
- **`KnowledgeService`** - Loads and indexes all JLPT data
  - Manifest-based dynamic loading
  - Token-based search indexing
  - Automatic embedding vectorization
  - Caching mechanisms

#### AI/Search
- **`SearchEngineService`** - Hybrid keyword + semantic search
  - Lesson/level hint extraction
  - Jaccard similarity
  - Vector similarity (with EmbeddingService)
  - Result ranking and merging

- **`EmbeddingService`** - Vector embedding generation
  - Batch processing with fallback
  - Cache management
  - Automatic vectorization of knowledge base

#### Prompt Building
- **`PromptBuilderService`** - Context window management
  - Domain-aware prompt templates
  - Snippet generation
  - Token counting

- **`EnhancedPromptBuilderService`** - Conversation-aware prompts
  - History management
  - Reference resolution
  - Contextual awareness

#### AI Communication
- **`OllamaService`** - Streaming chat interface
  - Fetch-based NDJSON streaming
  - Error handling and retry logic
  - SSR-aware implementation

- **`ProviderFactory`** - Provider abstraction
  - Local/Cloud provider switching
  - Configuration management

#### Backend
- **`SupabaseChatService`** - Database persistence
  - Session management
  - Message storage
  - Device-based access control
  - RLS-compliant queries

#### Learning
- **`GrammarService`** - Grammar lesson management
  - JSON loading and caching
  - Quiz generation with 5 question types
  - Statistics tracking
  - localStorage-based persistence

- **`MusicPlayerService`** - Audio playback
  - Playlist management
  - Track shuffling
  - Crossfading (not implemented)

### 11.2 UI Components (Reusable)

- **`AiAssistantComponent`** - Full chat interface
- **`AiChatBubbleComponent`** - Chat message display
- **`SlashCommandMenuComponent`** - Command palette
- **`ChatHistorySidebarComponent`** - Session history
- **`MusicPlayerComponent`** - Standalone player

### 11.3 Data Models

- **Knowledge Domains:** Grammar, Vocabulary, Kanji, Radicals, Reduplicative
- **Quiz Models:** Question, Answer, Result structures
- **AI Models:** Messages, Sessions, Settings
- **Chat Models:** Sessions, Messages (Supabase)

### 11.4 Utilities & Helpers

**Files in `src/app/ai/utils/`:**
- `tokenizer.util.ts` - Kanji/text tokenization
- `string-normalize.util.ts` - Query normalization
- `text-similarity.util.ts` - Jaccard/semantic similarity
- `vector-math.util.ts` - Vector operations
- `response-validator.util.ts` - Answer validation
- `abortable-stream.util.ts` - NDJSON streaming
- `item-builder.util.ts` - KnowledgeItem construction

---

## 12. Technical Risks and Problems

### 12.1 Critical Issues

#### 1. **No User Authentication Yet**
- Only device-based session tracking
- Future user system needs authentication layer
- Consider: Firebase Auth, Supabase Auth, OAuth

#### 2. **Grammar Loading Bug (Potential)**
**File:** `src/app/ai/services/knowledge.service.ts`, line 36
```typescript
{ domain: 'grammar', level: 'N3', pathTemplate: 'assets/grammar/N3-lesson{1-1}.json' }
```
**Issue:** File path uses `N3-lesson{1-1}.json` but actual files are `N3/lesson1.json`
**Status:** ⚠️ Will fail to load grammar data
**Impact:** Grammar domain will be empty on app startup

#### 3. **Incomplete Data Schema**
- JSON files have no unique ID fields
- Rely on array index + filename for identification
- Makes data versioning and updates difficult

#### 4. **No Quiz Persistence**
- Quiz results are not saved to database
- No progress tracking implemented
- User performance data is lost on page refresh

### 12.2 High-Priority Issues

#### 5. **Supabase Credentials in Repository**
**Files:** `src/environments/`
- Anon key and Project URL are exposed
- Should use environment variables
- Risk: Abuse of Supabase quota

#### 6. **No Error Handling for Missing Data**
- If JSON file fails to load, service continues silently
- Users won't know data is missing
- No fallback or retry mechanisms

#### 7. **Hard-Coded AI Model Names**
**File:** `src/environments/environment.ts`
- Model: `qwen3:0.6b`
- Cloud: `nemotron-3-super:cloud`
- Not configurable at runtime

#### 8. **Streaming Implementation Issues**
- NDJSON parsing in browser may fail on malformed responses
- No timeout handling for stuck streams
- Abort signal management incomplete

### 12.3 Medium-Priority Issues

#### 9. **No Lesson Numbering for Some Domains**
- Radicals: Lessons 1-17 (no level info)
- Reduplicative: Lessons 1-10 (no level info)
- Inconsistent with N2/N3/N4 structure

#### 10. **LocalStorage Dependency**
- Grammar and music playlist data stored in localStorage
- Subject to 5-10MB limit
- No cleanup strategy for old data

#### 11. **Incomplete API/Server.ts**
**File:** `src/server.ts`
- Proxy to Ollama at `http://127.0.0.1:11434` (localhost hardcoded)
- Will fail in production Vercel environment
- No actual Ollama instance available on Vercel

#### 12. **Mobile Deployment Incomplete**
- Capacitor configured but no build scripts in package.json
- Android APK not buildable without additional setup
- No iOS configuration present

---

## 13. Recommendations for the Future JLPT Daily Training System

### 13.1 Architecture Recommendations

#### 1. **Create New Module: `daily-quiz`**
```
src/app/daily-quiz/
├── components/
│   ├── daily-quiz.component.ts
│   ├── quiz-question.component.ts
│   ├── quiz-results.component.ts
│   └── quiz-timer.component.ts
├── services/
│   ├── daily-quiz.service.ts
│   ├── quiz-engine.service.ts
│   └── quiz-scheduling.service.ts
├── models/
│   ├── daily-quiz.model.ts
│   └── quiz-result.model.ts
├── utils/
│   └── quiz-generator.util.ts
└── daily-quiz-routing.module.ts
```

#### 2. **Fix Grammar Data Loading**
- Correct file path in `knowledge.service.ts` from:
  ```typescript
  'assets/grammar/N3-lesson{1-1}.json'
  ```
  to:
  ```typescript
  'assets/grammar/N3/lesson{1-30}.json'
  ```
- Add N2, N4 grammar if data exists

#### 3. **Implement Daily Scheduling**
**Option A: Browser-based (Simple)**
- Use `setInterval` or browser Notification API
- Requires app to be open at 7 AM

**Option B: Backend Cron (Recommended)**
- Vercel Edge Functions (Node.js @ Edge)
- Supabase PG Cron Extension
- Cloud Scheduler (GCP) + Webhook

**Option C: Hybrid (Robust)**
- Backend creates quiz at 7 AM
- Browser checks on app load
- Web Push notification (if opted-in)

#### 4. **Extend Supabase Schema**
```sql
-- Daily Quiz Tracking
CREATE TABLE daily_quizzes (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID NOT NULL,
  quiz_date DATE NOT NULL,
  domains TEXT[] NOT NULL,              -- ['vocab', 'grammar', 'kanji']
  question_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(device_id, quiz_date)
);

CREATE TABLE daily_quiz_questions (
  id BIGSERIAL PRIMARY KEY,
  daily_quiz_id BIGSERIAL REFERENCES daily_quizzes(id),
  question_index INTEGER,
  domain TEXT,
  question_text TEXT,
  correct_answer TEXT,
  options JSONB,
  source_id TEXT                       -- Reference to vocab/grammar/kanji ID
);

CREATE TABLE daily_quiz_results (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID NOT NULL,
  daily_quiz_id BIGSERIAL REFERENCES daily_quizzes(id),
  question_id BIGSERIAL REFERENCES daily_quiz_questions(id),
  user_answer TEXT,
  is_correct BOOLEAN,
  time_spent_seconds INTEGER,
  submitted_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE quiz_statistics (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID NOT NULL,
  streak_days INTEGER,
  total_quizzes INTEGER,
  total_correct INTEGER,
  total_attempted INTEGER,
  last_quiz_date DATE,
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(device_id)
);
```

#### 5. **Quiz Generation Strategy**
```typescript
// Random selection from each domain
const generateDailyQuiz = (count = 20) => {
  return [
    ...selectRandom(vocabularyPool, 7),      // 7 vocab
    ...selectRandom(grammarPool, 8),         // 8 grammar
    ...selectRandom(kanjiPool, 5)            // 5 kanji
  ].shuffle();
};
```

#### 6. **Scoring System**
```typescript
interface QuizScore {
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;                     // 0-100%
  timeElapsed: number;                  // seconds
  averageTimePerQuestion: number;       // seconds
  streakStatus: 'broken' | 'maintained' | 'extended';
}
```

### 13.2 Implementation Priorities

| Phase | Feature | Effort | Duration |
|-------|---------|--------|----------|
| 1 | Fix grammar data path | 1hr | 1 day |
| 1 | Create daily-quiz module | 4hrs | 2 days |
| 1 | Extend Supabase schema | 2hrs | 1 day |
| 2 | Quiz generation engine | 6hrs | 3 days |
| 2 | Quiz UI components | 8hrs | 3 days |
| 3 | Scheduling (browser-based) | 4hrs | 2 days |
| 3 | Scoring & results | 4hrs | 2 days |
| 4 | Statistics dashboard | 6hrs | 3 days |
| 4 | Notifications (backend) | 8hrs | 3-5 days |
| 5 | Mobile optimization | 4hrs | 2 days |

### 13.3 Dependencies to Install

```bash
# Optional but recommended
npm install date-fns                    # Date handling
npm install crypto-js                   # Cryptography (if needed)
npm install zod                         # Schema validation (optional)
```

### 13.4 Testing Strategy for Daily Quiz

```typescript
// Unit tests needed for:
- QuizGeneratorUtil.generateDailyQuiz()
- QuizEngineService.scoreAnswer()
- QuizSchedulingService.checkIfDueForDaily()
- DailyQuizResultsCalculator

// E2E tests:
- User sees daily quiz at 7 AM
- Quiz submission saves to Supabase
- Results calculated correctly
- Streak updates properly
```

### 13.5 Security Considerations

1. **Validate Quiz Answers Server-Side**
   - Don't trust browser-calculated scores
   - Implement answer validation in Vercel Edge Function

2. **Rate Limiting**
   - Prevent quiz spam (e.g., 1 per device per day)
   - Implement in RLS policy or middleware

3. **Data Privacy**
   - User quiz data tied to device_id only
   - No personal data collection
   - Follow GDPR for storage duration

4. **Input Validation**
   - Validate quiz parameters (domain, count)
   - Sanitize user answers before storage

### 13.6 Performance Optimization

1. **Lazy Load Quiz Module**
   - Only load when `/daily-quiz` route activated
   - Reduce initial bundle size

2. **Cache Quiz Questions**
   - Store today's quiz in localStorage
   - Reduce API calls

3. **Batch Score Calculations**
   - Calculate streak/stats once per quiz completion
   - Not on every answer submission

4. **Database Indexing**
   ```sql
   CREATE INDEX idx_daily_quiz_device_date ON daily_quizzes(device_id, quiz_date);
   CREATE INDEX idx_quiz_results_device ON daily_quiz_results(device_id);
   ```

---

## 14. File Locations Quick Reference

### Data Assets
```
src/assets/
├── grammar/
│   └── N3/
│       ├── lesson1.json to lesson19.json
│       └── More files not yet listed
├── vocab-data/
│   ├── N2/ (24 lessons)
│   ├── N3/ (22 lessons)
│   ├── N4/ (25 lessons)
│   └── N5/ (26+ lessons)
├── kanji-words-data/
│   ├── N2/ (48 lessons)
│   ├── N3/ (30 lessons)
│   └── N4/ (26 lessons)
├── kanji-radicard-data/
│   └── lesson1.json to lesson17.json
├── reduplicative-words-data/
│   └── lesson1.json to lesson10.json
└── ai/
    └── manifest.json
```

### Source Code Structure
```
src/app/
├── home/
├── vocabulary/
├── grammar/
│   └── models/grammar.model.ts
│   └── services/grammar.service.ts
├── kanjiWords/
├── kanjiRadicals/
├── reduplicativeWords/
├── catholic/
├── adverb/
├── ai/
│   ├── models/
│   ├── services/
│   ├── components/
│   ├── providers/
│   └── utils/
├── music-player/
├── services/
│   └── music-player.service.ts
└── app-routing.module.ts
```

---

## 15. Summary of Findings

### What's Working Well
✅ Angular 19 with SSR fully configured  
✅ Supabase backend ready and integrated  
✅ Comprehensive JLPT data (Grammar, Vocab, Kanji, Radicals)  
✅ AI integration with Ollama and OpenAI support  
✅ PWA with offline caching  
✅ Semantic search + embeddings infrastructure  
✅ Modular architecture with lazy loading  
✅ TypeScript strict mode enabled  
✅ Mobile support with Capacitor  

### What Needs Fixing
⚠️ **CRITICAL:** Grammar file path bug (N3-lesson vs N3/lesson)  
⚠️ Grammar module likely empty due to path mismatch  
⚠️ Supabase credentials exposed in repository  
⚠️ No user authentication layer  
⚠️ No quiz persistence or progress tracking  

### What's Missing for Daily Quiz System
❌ Daily scheduling mechanism  
❌ Quiz generation and question selection  
❌ Quiz result persistence  
❌ Scoring and statistics calculation  
❌ Streak tracking  
❌ Notification system  
❌ Quiz UI components and routing  

### Effort Estimate
- **Fix Existing Issues:** 1-2 days
- **Implement Daily Quiz System:** 2-3 weeks (depending on scope)
- **Full Testing & Deployment:** 1 week

---

## 16. Analysis Conclusion

The project has a **solid foundation** for building the Daily JLPT Training system. The architecture is modular, the data is well-organized, and the backend infrastructure (Supabase) is ready. However, there are **critical bugs** (grammar path) and **architectural gaps** (authentication, quiz persistence) that must be addressed before implementing the daily training feature.

**Next Steps:**
1. ✅ Review this analysis
2. ✅ Confirm the grammar path bug
3. ✅ Fix security issues (credentials)
4. ✅ Design Daily Quiz feature in detail
5. ✅ Implement in phases (core features first)

---

**Document Version:** 1.0  
**Last Updated:** 2025-09-08  
**Status:** Analysis Complete - Ready for Implementation Planning
