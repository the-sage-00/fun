# Brilliantify 🧠✨

**AI-Powered Study Platform** — Transform your study PDFs into interactive learning experiences.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-cyan)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)

## Features

### Core
- 📄 **PDF Upload & Processing** — Upload PDFs, auto-extract text, chunk, and embed
- 📝 **Smart Summaries** — AI-generated structured summaries with key concepts, examples, takeaways
- 🧠 **Quiz Generator** — MCQs, True/False, Short Answer with explanations and scoring
- 🃏 **Flashcards with Spaced Repetition** — SM-2 algorithm for optimal retention
- 💬 **AI Study Chatbot** — RAG-powered Q&A about your documents
- 🎥 **Video Explanations** — AI-generated slide presentations with TTS narration
- 🗺️ **Concept Maps** — Visual knowledge graphs of document concepts

### Analytics & Tracking
- 📊 **Progress Dashboard** — XP, levels, streaks, study time charts
- 🎯 **Exam Tracker** — Log scores, set goals, track improvement
- 📈 **Topic Mastery** — Per-topic mastery percentages
- 🧭 **AI Weakness Detection** — Identify weak areas after quizzes

### Planning & Gamification
- 📚 **AI Study Plans** — Personalized schedules based on exam date and syllabus
- 🏆 **Gamification** — XP points, levels, streaks, badges
- 🔔 **Smart Reminders** — Flashcard review, exam dates, streak warnings
- 🔍 **Semantic Search** — Search across all uploaded documents

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, TailwindCSS 4 |
| UI Components | Radix UI primitives, custom ShadCN-style components |
| Animation | Framer Motion |
| Charts | Recharts |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| AI/LLM | OpenRouter (free models) |
| Embeddings | HuggingFace Inference API (sentence-transformers) |
| PDF | pdf-parse |
| State | Zustand |

## Getting Started

### Prerequisites
- Node.js 18+
- npm
- A Supabase account (free tier)
- OpenRouter API key (free)
- HuggingFace API key (free)

### 1. Clone & Install

```bash
cd Brilliantify
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration file:
   - Copy the contents of `supabase/migrations/001_initial_schema.sql`
   - Paste and run in the SQL Editor
3. Go to **Storage** and ensure the `documents` bucket exists (auto-created by migration)
4. Go to **Settings > API** and copy your URL and anon key

### 3. Get API Keys

**OpenRouter (Free LLM):**
1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Copy your API key from the dashboard
3. The app uses `mistralai/mistral-7b-instruct:free` by default

**HuggingFace (Free Embeddings):**
1. Sign up at [huggingface.co](https://huggingface.co)
2. Go to Settings > Access Tokens
3. Create a new token with read access

### 4. Configure Environment

Copy `.env.local` and fill in your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

OPENROUTER_API_KEY=your-openrouter-key
HUGGINGFACE_API_KEY=your-huggingface-key

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Add all environment variables from `.env.local`
4. Deploy!

### 3. Update Environment

Set `NEXT_PUBLIC_APP_URL` to your Vercel URL.

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/          # Protected dashboard routes
│   │   ├── dashboard/        # Main dashboard
│   │   ├── upload/           # PDF upload
│   │   ├── documents/        # Document management
│   │   │   └── [id]/         # Document detail
│   │   │       ├── summary/  # AI summary
│   │   │       ├── quiz/     # Quiz interface
│   │   │       ├── flashcards/ # Flashcard viewer
│   │   │       ├── chat/     # AI chatbot
│   │   │       ├── video/    # Video explanation
│   │   │       └── concept-map/ # Knowledge graph
│   │   ├── analytics/        # Progress analytics
│   │   ├── exams/            # Exam tracker
│   │   ├── study-plans/      # AI study plans
│   │   └── settings/         # User settings
│   ├── api/                  # API routes
│   ├── login/                # Login page
│   ├── register/             # Register page
│   └── page.tsx              # Landing page
├── components/ui/            # UI primitives
├── lib/
│   ├── ai/                   # AI pipeline (LLM, embeddings)
│   ├── pdf/                  # PDF processing
│   ├── supabase/             # Database clients
│   └── utils.ts              # Utilities
├── stores/                   # Zustand state
└── types/                    # TypeScript types
```

## Database Schema

13 tables including:
- `profiles` — User data, XP, streaks
- `documents` — Uploaded PDFs
- `document_chunks` — Text chunks with vector embeddings
- `summaries` — AI-generated summaries
- `quizzes` / `quiz_attempts` — Quiz data and results
- `flashcards` — Spaced repetition cards
- `chat_messages` — Chatbot history
- `exam_scores` — Exam tracking
- `study_plans` — AI study schedules
- `topic_mastery` — Per-topic metrics
- `badges` — Gamification achievements

## License

MIT
