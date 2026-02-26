# Cover Letter Generator

An AI-powered job application toolkit that generates tailored cover letters, CVs, interview preparation packs, and conducts mock phone interviews — all from your profile and uploaded documents.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Security](#security)
- [Available Scripts](#available-scripts)
- [Troubleshooting](#troubleshooting)

## Features

### Cover Letter Generation
- AI-generated cover letters using Anthropic Claude with streaming responses
- Executive summary generation alongside each cover letter
- Anti-hallucination system that pre-extracts verified facts from your documents
- Feedback analysis with match score, improvement suggestions, and keyword analysis
- Chat-based refinement for both cover letters and executive summaries
- Multi-language support (Danish/English auto-detection)

### CV Tailoring
- AI-tailored CVs matched to specific job descriptions
- Three templates: Classic, Hybrid, Executive
- PDF export via jsPDF direct text API
- Save application packages (CV + cover letter + job listing) to local folder or ZIP

### Interview Preparation
- Company research with mission, values, culture, news, and competitive landscape
- 12–15 tailored interview questions with suggested answers
- STAR-format talking points drawn from your experience documents
- Audio briefing (podcast-style) for on-the-go preparation

### Mock Interview
- AI recruiter "Alex" calls you for a realistic phone screen via Vapi.ai
- Uses company research, interview questions, and your CV to stay in character
- Digs deeper on vague answers, asks for metrics and specifics
- Post-call feedback report: overall score, 5 category scores (Communication, Technical, Cultural Fit, Problem-Solving, Pressure Handling), per-question breakdown with suggested better answers, strengths, improvement areas, and action items
- Multiple attempts tracked per briefing

### General
- Profile management with document uploads (CV, experience notes)
- Job URL scraping (auto-extract job descriptions from URLs)
- Secure email/password authentication via Supabase Auth
- Cloud storage with Row Level Security in Supabase PostgreSQL

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 7
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand
- **Database**: Supabase (PostgreSQL with RLS)
- **Authentication**: Supabase Auth (email/password with password reset)
- **Backend**: Vercel Serverless Functions (12/12 Hobby plan limit)
- **AI**: Anthropic Claude API (server-side)
  - Claude Haiku 4.5 for fact extraction and job detail parsing
  - Claude Sonnet 4 for generation (cover letters, CVs, interview prep, feedback)
- **Voice**: Vapi.ai with Deepgram transcription and ElevenLabs TTS
- **PDF**: jsPDF direct text API (not html2canvas — oklch colors crash it)

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React SPA     │────▶│  Vercel API     │────▶│   Anthropic     │
│   (Vite)        │     │  (12 functions) │     │   Claude API    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       ├──────────────▶┌─────────────────┐
        ▼                       │               │   Vapi.ai       │
┌─────────────────┐             │               │  (Phone + TTS)  │
│  Supabase Auth  │             │               └─────────────────┘
│  (JWT tokens)   │             │
└─────────────────┘             ▼
        │               ┌─────────────────┐
        └──────────────▶│   Supabase      │
                        │   PostgreSQL    │
                        │   (with RLS)    │
                        └─────────────────┘
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Supabase account
- Vercel account (for deployment)
- Anthropic API key
- Vapi.ai API key and phone number ID (optional, for phone interviews and mock interviews)

### Local Development

```bash
git clone https://github.com/mimo01ac/cover-letter-generator.git
cd cover-letter-generator
npm install

# Create .env file with Supabase credentials (see Environment Variables)

npm run dev
```

The app will be available at `http://localhost:5173`.

## Environment Variables

### Frontend (`.env`)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Vercel (Server-side)

Set these in the Vercel dashboard under Environment Variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
VAPI_API_KEY=...              # Required for phone interviews / mock interviews
VAPI_PHONE_NUMBER_ID=...      # Required for phone interviews / mock interviews
```

## Usage

1. **Sign up** with email and password
2. **Create a profile** and upload your CV and experience documents
3. **Generate a cover letter**: paste a job URL or description, click Generate
4. **Review feedback**: match score, suggestions, and keyword gaps
5. **Refine**: use the chat interface to tweak the letter or executive summary
6. **Tailor your CV**: go to CV Tailor, select a job, choose a template, generate
7. **Save application package**: download CV + cover letter + job listing as folder or ZIP
8. **Prepare for interview**: go to Interview Prep, generate a briefing pack (company research, questions, STAR stories, audio)
9. **Mock interview**: click the Mock Interview tab, enter your phone number, and receive a realistic phone screen from an AI recruiter — get a detailed performance report afterward

## Project Structure

```
├── api/                              # Vercel serverless functions (12/12)
│   ├── cover-letter/
│   │   ├── generate.ts               # Generate cover letter + summary (streaming)
│   │   └── analyze.ts                # Feedback analysis + job detail extraction
│   ├── cover-letter-refine.ts        # Refine letter/summary via chat (streaming)
│   ├── cv-tailor.ts                  # CV generation + refinement (query action)
│   ├── interview-prep/
│   │   ├── generate.ts               # Generate briefing, questions, talking points
│   │   ├── refine.ts                 # Refine interview prep content
│   │   ├── research.ts               # Company/industry research
│   │   └── generate-audio.ts         # Audio briefing generation
│   └── interview/
│       ├── generate-guide.ts         # Generate interview guide (career interview)
│       ├── start-call.ts             # Start Vapi call (career or mock mode)
│       ├── call-status.ts            # Poll call status
│       └── process-transcript.ts     # Process transcript (insights or feedback)
├── supabase/
│   └── schema.sql                    # Database schema with RLS policies
├── src/
│   ├── components/
│   │   ├── Auth/                     # Login, signup, forgot/reset password
│   │   ├── Layout/                   # App shell, navigation sidebar
│   │   ├── Profile/                  # Profile form, document upload, career interview
│   │   ├── CoverLetter/              # Generation, refinement, history, feedback
│   │   ├── CVTailor/                 # CV tailoring, template preview, save package
│   │   ├── InterviewPrep/            # Briefing, questions, stories, audio, mock interview
│   │   └── Settings/                 # Account settings
│   ├── contexts/
│   │   └── AuthContext.tsx            # Supabase auth context provider
│   ├── lib/
│   │   ├── supabase.ts               # Supabase client
│   │   └── database.types.ts         # Generated DB types
│   ├── services/
│   │   ├── claude.ts                 # Claude API client (streaming)
│   │   ├── cvTailor.ts               # CV tailoring service
│   │   ├── db.ts                     # Supabase CRUD operations
│   │   ├── documentParser.ts         # Parse uploaded documents
│   │   ├── feedbackAnalyzer.ts       # Cover letter analysis
│   │   ├── interviewGuideCache.ts    # Interview guide caching
│   │   ├── interviewPrep.ts          # Interview prep generation
│   │   ├── jobScraper.ts             # URL scraping + job detail extraction
│   │   └── vapiInterview.ts          # Vapi.ai integration (career + mock modes)
│   ├── stores/
│   │   └── useStore.ts               # Zustand store (UI state)
│   ├── types/
│   │   └── index.ts                  # TypeScript interfaces
│   └── utils/
│       ├── applicationPackage.ts     # Save package (folder/ZIP)
│       └── pdfExport.ts              # jsPDF CV export
├── vercel.json                       # Vercel config (rewrites, function limits)
└── .env.example                      # Environment variable template
```

### Routes

| Path | Page | Description |
|------|------|-------------|
| `/` | Cover Letter | Generate and refine cover letters |
| `/cv-tailor` | CV Tailor | Tailor CVs to job descriptions |
| `/interview-prep` | Interview Prep | Briefing, questions, stories, audio, mock interview |
| `/profile` | Profile | Manage profile and upload documents |
| `/history` | History | View past cover letters |
| `/settings` | Settings | Account settings |
| `/reset-password` | Reset Password | Password reset flow (public) |

## Deployment

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL Editor
3. Copy your project URL and anon key from Settings > API

### 2. Vercel Setup

1. Import the GitHub repository at [vercel.com](https://vercel.com)
2. Add all environment variables (see above)
3. Deploy — Vercel auto-builds on push to `main`

**Important**: The Vercel Hobby plan allows 12 serverless functions max. The project is at exactly 12. New API endpoints must be consolidated into existing ones using query parameters or request body routing.

### 3. Authentication

1. In Supabase dashboard: Authentication > Providers > enable Email
2. Optionally disable email confirmation for testing
3. Customize email templates under Auth > Email Templates

## Security

- **API keys**: Anthropic and Vapi keys are server-side only (Vercel env vars)
- **Authentication**: JWT sessions via Supabase Auth
- **Data isolation**: Row Level Security on all tables — users only see their own data
- **Anti-hallucination**: Fact extraction prevents fabricated claims in cover letters
- **No indexing**: Site uses noindex/nofollow meta tags

### Anti-Hallucination System

Before generating a cover letter, Claude Haiku extracts a verified fact inventory from your documents:
- Skills (confidence: explicit / demonstrated / mentioned)
- Achievements (with exact metrics only if present in source)
- Credentials (degrees, certifications, job titles)
- Companies

The generation prompt enforces that every claim maps to this inventory. No fabricated metrics, no unsupported superlatives, no invented credentials.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 5173 |
| `npm run build` | Type-check (`tsc -b`) then build for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build locally |

## Troubleshooting

### Authentication Issues
1. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`
2. Ensure Email provider is enabled in Supabase Auth settings
3. Check browser console for errors

### Cover Letter Generation Fails
1. Verify `ANTHROPIC_API_KEY` is set in Vercel
2. Check Vercel function logs
3. Ensure Anthropic account has credits

### Mock Interview / Phone Interview Not Working
1. Verify `VAPI_API_KEY` and `VAPI_PHONE_NUMBER_ID` are set in Vercel
2. International calls require a paid Vapi phone number
3. Mock interview requires a briefing to be generated first
4. Check Vercel function logs for errors

### PDF Export Issues
- PDF generation uses jsPDF text API, not html2canvas (oklch colors crash it)
- If CV PDF looks wrong, check that `TailoredCVData` has the expected structure

### Profile/Document Save Fails
1. Create a profile before uploading documents
2. Check browser console for Supabase errors
3. Verify the schema has been applied in Supabase

## License

Private — All rights reserved
