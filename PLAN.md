# PLAN — Cover Letter Generator

> How the product is built: architecture, stack, modules, and key decisions.

## Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 19, TypeScript, Vite 7 | SPA with client-side routing |
| Styling | Tailwind CSS 4 | Uses oklch color space |
| State | Zustand | Minimal UI state only; data lives in Supabase |
| Database | Supabase PostgreSQL | RLS on all tables |
| Auth | Supabase Auth | Email/password, JWT sessions |
| Backend | Vercel Serverless Functions | 12 functions max (Hobby plan) |
| AI | Anthropic Claude API | Haiku 4.5 (extraction), Sonnet 4 (generation) |
| Voice | Vapi.ai | Phone calls, Deepgram transcription, ElevenLabs TTS |
| PDF | jsPDF | Direct text API — no DOM screenshot |
| Documents | docx, file-saver, jszip | Word export and ZIP packaging |

## Architecture

```
Browser (React SPA)
  ├── Supabase Auth (JWT)
  ├── Supabase PostgreSQL (all persistent data)
  └── Vercel API (12 serverless functions)
        ├── Anthropic Claude API
        └── Vapi.ai (phone calls)
```

All AI calls go through Vercel serverless functions — API keys never reach the client. The frontend communicates with Supabase directly for auth and CRUD, and with Vercel API routes for AI operations.

## Serverless Functions (12/12)

| Endpoint | File | Purpose |
|----------|------|---------|
| POST `/api/cover-letter/generate` | `api/cover-letter/generate.ts` | Streaming cover letter + executive summary |
| POST `/api/cover-letter/analyze` | `api/cover-letter/analyze.ts` | Feedback analysis + job detail extraction |
| POST `/api/cover-letter/refine` | `api/cover-letter-refine.ts` | Refine letter or summary (rewrite) |
| POST `/api/cv-tailor/generate` | `api/cv-tailor.ts?action=generate` | Generate tailored CV |
| POST `/api/cv-tailor/refine` | `api/cv-tailor.ts?action=refine` | Refine CV via chat |
| POST `/api/interview-prep/research` | `api/interview-prep/research.ts` | Company and industry research |
| POST `/api/interview-prep/generate` | `api/interview-prep/generate.ts` | Briefing, questions, talking points |
| POST `/api/interview-prep/refine` | `api/interview-prep/refine.ts` | Refine interview prep content |
| POST `/api/interview-prep/generate-audio` | `api/interview-prep/generate-audio.ts` | Audio briefing (TTS) |
| POST `/api/interview/generate-guide` | `api/interview/generate-guide.ts` | Interview guide for career interview |
| POST `/api/interview/start-call` | `api/interview/start-call.ts` | Start Vapi call (career or mock mode) |
| GET `/api/interview/call-status` | `api/interview/call-status.ts` | Poll call status |
| POST `/api/interview/process-transcript` | `api/interview/process-transcript.ts` | Extract insights or generate mock feedback |

**Consolidation strategy**: Vercel rewrites map virtual paths to query-parameter-routed functions (e.g., `/api/cv-tailor/generate` → `/api/cv-tailor?action=generate`). This keeps the function count at 12.

## Database Tables

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `profiles` | name, email, phone, location, summary | One per user |
| `documents` | profile_id, name, type, content | CV, experience, other |
| `cover_letters` | profile_id, job_title, company_name, job_description, content, executive_summary | |
| `interview_results` | profile_id, call_id, mode, briefing_id, transcript, feedback | Career + mock interviews |
| `interview_guides` | profile_id, guide, documents_hash | Cached guides per profile |
| `interview_briefings` | profile_id, job_title, company_research, interview_questions, talking_points, podcast_script, audio_url | Full briefing pack |
| `tailored_cvs` | profile_id, job_title, selected_template, cv_data, language | Tailored CV data |

All tables have RLS policies scoping access to the authenticated user via `profile_id → user_id`.

## Key Modules

### Services (`src/services/`)

| Service | Responsibility |
|---------|---------------|
| `claude.ts` | Streaming API calls to Claude (cover letters, summaries) |
| `cvTailor.ts` | CV generation and refinement |
| `db.ts` | All Supabase CRUD (profiles, documents, cover letters, interviews, briefings, CVs) |
| `documentParser.ts` | Parse uploaded files (PDF, text) |
| `feedbackAnalyzer.ts` | Cover letter match analysis |
| `interviewGuideCache.ts` | Cache/invalidate interview guides |
| `interviewPrep.ts` | Orchestrate briefing generation (research → generate → questions → stories → podcast) |
| `jobScraper.ts` | Extract job details from URLs or pasted text |
| `vapiInterview.ts` | Vapi.ai integration — build prompts, start calls, poll status, process transcripts |

### Components (`src/components/`)

| Directory | Key Components |
|-----------|---------------|
| `Auth/` | LoginPage, SignUpPage, ForgotPassword, ResetPassword |
| `Layout/` | AppLayout, Sidebar navigation |
| `Profile/` | ProfileForm, DocumentUpload, InterviewModal |
| `CoverLetter/` | CoverLetterPage, LetterDisplay, FeedbackPanel, SummaryRefinement |
| `CVTailor/` | CVTailorPage, CVPreview, SavePackage |
| `InterviewPrep/` | InterviewPrepPage (tabs: Briefing, Questions, Stories, Audio, Mock Interview), MockInterview, MockInterviewFeedbackReport |
| `Settings/` | SettingsPage |

## Key Technical Decisions

### PDF Generation
html2canvas/html2pdf.js cannot parse Tailwind v4's `oklch()` color functions. Replaced with jsPDF direct text API that builds PDFs from structured `TailoredCVData` — no DOM involvement.

### File System Access API
Used for saving application packages to local folders. Cloud-synced folders (Google Drive, iCloud, Dropbox, OneDrive) use virtual filesystems where writes silently fail. The app verifies writes by reading back file size and falls back to ZIP download on failure.

### Mock Interview Mode
Reuses the existing 4 Vapi endpoints by adding a `mode` parameter (`career-interview` | `mock-interview`). Zero new serverless functions. The recruiter prompt is built from the briefing's company research, interview questions, and candidate CV.

### Function Consolidation
Vercel Hobby plan limits to 12 serverless functions. Multiple logical endpoints share a single function file using query parameters or request body routing (e.g., `cv-tailor.ts` handles both generate and refine via `?action=`).

## References

- [README.md](README.md) — setup, usage, deployment
- [SPEC.md](SPEC.md) — product requirements and scope
