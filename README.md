# 🇯🇵 AI-Powered Japanese Vocabulary Learning App

[![Angular](https://img.shields.io/badge/Angular-19-DD0031?style=flat-square&logo=angular)](https://angular.io/)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![OpenAI](https://img.shields.io/badge/AI-OpenAI%20%2F%20Ollama-412991?style=flat-square&logo=openai)](https://openai.com/)
[![Capacitor](https://img.shields.io/badge/Mobile-Capacitor-333333?style=flat-square&logo=capacitor)](https://capacitorjs.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=flat-square&logo=vercel)](https://vercel.com/)

A comprehensive, AI-driven ecosystem designed to accelerate Japanese language acquisition. This application blends structured linguistic learning with state-of-the-art Large Language Models (LLMs) to provide a personalized, interactive tutoring experience.

## 🚀 Key Features

### 🧠 AI-Enhanced Learning (The Core)
*   **Intelligent AI Assistant**: A sophisticated chat interface integrated with **OpenAI** and **Ollama** for real-time linguistic support.
*   **Semantic Search & RAG**: Implements **Retrieval-Augmented Generation (RAG)** using text embeddings and vector math, allowing the AI to provide context-aware answers based on a curated Japanese knowledge base.
*   **Hybrid AI Architecture**: Supports both cloud-based (OpenAI) and local-hosted (Ollama) models for flexibility and privacy.
*   **Advanced AI Tooling**: Includes slash commands for quick actions and integrated conversation memory stored via **Supabase**.

### 📚 Structured Curriculum
*   **Diverse Learning Modules**: Specialized tracks for:
    *   **Vocabulary**: Core word lists with interactive testing.
    *   **Kanji**: Dedicated modules for both Radicals and Kanji Words.
    *   **Grammar**: Lesson-based learning with integrated quizzes.
    *   **Specialized Content**: Focused tracks for Adverbs and Reduplicative Words.
    *   **Number Practice**: Interactive Japanese numbering system training.
*   **Active Recall Tools**: Implementation of **Flashcards** and **Quizzes** across all modules to ensure long-term retention.

### 📱 Cross-Platform Experience
*   **Web & Mobile**: Built with **Angular 19** and **Capacitor**, providing a seamless experience across modern browsers and Android devices.
*   **High Performance**: Utilizes **Server-Side Rendering (SSR)** for optimized initial load times and SEO.

## 🛠 Technical Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | Angular 19 (SSR) | Reactive UI, Type-safe development, and fast rendering. |
| **Mobile** | Capacitor | Native Android wrapper for cross-platform deployment. |
| **Database** | Supabase | User authentication, chat history, and cloud storage. |
| **AI Engine** | OpenAI / Ollama | LLM orchestration for tutoring and translation. |
| **AI Logic** | Embeddings / Vector Math | Semantic search and RAG implementation. |
| **Infrastructure**| Vercel | Continuous Deployment and Edge Functions (API). |

## 🏗 Architecture Highlights

The application follows a modular architecture to ensure scalability:
- **`api/`**: Serverless functions handling heavy AI computations, embedding generation, and secure API proxying.
- **`src/app/ai/`**: A decoupled AI subsystem featuring provider-agnostic interfaces, allowing easy switching between different LLM providers.
- **`src/app/[module]/`**: Domain-driven design for learning modules (Vocabulary, Grammar, etc.), each containing its own logic for flashcards and testing.

## ⚙️ Getting Started

### Prerequisites
- Node.js (v18+)
- Angular CLI (`npm install -g @angular/cli`)
- Supabase Account
- OpenAI API Key (or a running Ollama instance)

### Installation
1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/japanese-vocab-app.git
   cd japanese-vocab-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file (or configure Vercel environment variables) with:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_anon_key
   OPENAI_API_KEY=your_openai_key
   ```

4. **Run in Development Mode**
   ```bash
   ng serve
   ```
   Navigate to `http://localhost:4200/`.

5. **Build for Production**
   ```bash
   ng build
   ```

## 🗺 Roadmap
- [ ] Implementation of Spaced Repetition System (SRS) for flashcards.
- [ ] Voice-to-Text integration for pronunciation practice.
- [ ] Community-driven vocabulary sharing.
- [ ] Expanded grammar datasets with AI-generated examples.

---
**Developed by [Your Name]**  
*Passionate about blending Language Learning with Artificial Intelligence.*
