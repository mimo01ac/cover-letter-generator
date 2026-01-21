# Cover Letter Generator - Project Context

Last updated: 2025-01-21

## Project Overview

A React + TypeScript application for generating personalized cover letters using AI (Claude API). The app includes profile management, CV upload, AI-powered cover letter generation with feedback analysis, and an AI phone interview feature.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 7
- **Styling:** Tailwind CSS 4
- **State Management:** Zustand
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth (email/password)
- **Backend:** Vercel Serverless Functions
- **AI:** Anthropic Claude API (server-side)
- **Voice Interview:** Vapi.ai (server-side)

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React App     │────▶│  Vercel API     │────▶│   Anthropic     │
│   (Frontend)    │     │  (Serverless)   │     │   Claude API    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       │
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  Supabase Auth  │     │   Vapi.ai       │
│  (JWT tokens)   │     │   (Phone API)   │
└─────────────────┘     └─────────────────┘
        │
        ▼
┌─────────────────┐
│   Supabase      │
│   PostgreSQL    │
│   (with RLS)    │
└─────────────────┘
```

## Key Features

### 1. Authentication (Supabase Auth)
- Email/password authentication
- JWT-based session management
- Automatic token refresh
- Protected routes via AuthContext
- Files: `src/contexts/AuthContext.tsx`, `src/components/Auth/LoginPage.tsx`

### 2. Cover Letter Generation
- Job URL scraping with CORS proxy fallback (supports jobindex.dk)
- Custom notes field for user instructions to AI
- Language detection (Danish/English)
- Streaming response display via Server-Sent Events
- Files: `src/components/CoverLetter/Generator.tsx`, `src/services/claude.ts`, `api/cover-letter/generate.ts`

### 3. Feedback Analysis
- Automatic analysis after cover letter generation
- Match score (0-100%)
- 3-5 improvement suggestions
- Missing keywords from job description
- Strengths identified
- Works in both Generator and History pages
- Files: `src/components/CoverLetter/FeedbackAnalysis.tsx`, `src/services/feedbackAnalyzer.ts`, `api/cover-letter/analyze.ts`

### 4. AI Phone Interview (Vapi.ai)
- Analyzes CV and generates custom interview guide
- **Pre-generates interview guide in background when CV is uploaded** (no wait time)
- Automatically regenerates guide when CV/experience documents change
- Makes outbound phone call via Vapi
- AI conducts 15-20 minute interview
- Processes transcript and extracts insights
- Saves insights as document for future cover letters
- Files: `src/components/Profile/InterviewModal.tsx`, `src/services/vapiInterview.ts`, `api/interview/*`

### 5. History
- View past cover letters
- Analyze old cover letters with feedback
- Chat refinement for modifications

## File Structure

```
├── api/                           # Vercel serverless functions
│   ├── cover-letter/
│   │   ├── generate.ts            # Generate cover letter (streaming)
│   │   ├── refine.ts              # Refine via chat (streaming)
│   │   └── analyze.ts             # Feedback analysis
│   └── interview/
│       ├── generate-guide.ts      # Generate interview guide
│       ├── start-call.ts          # Start Vapi phone call
│       ├── call-status.ts         # Poll call status
│       └── process-transcript.ts  # Process interview transcript
├── supabase/
│   └── schema.sql                 # Database schema with RLS policies
├── src/
│   ├── components/
│   │   ├── Auth/
│   │   │   └── LoginPage.tsx      # Login/signup page
│   │   ├── CoverLetter/
│   │   │   ├── Generator.tsx      # Main cover letter generation
│   │   │   ├── ChatRefinement.tsx # Refine letters via chat
│   │   │   ├── FeedbackAnalysis.tsx # Score & suggestions display
│   │   │   └── HistoryPage.tsx    # View past letters
│   │   ├── Layout/
│   │   │   ├── AppLayout.tsx      # Main layout with auth guard
│   │   │   └── Navigation.tsx     # Top navigation with sign out
│   │   ├── Profile/
│   │   │   ├── ProfilePage.tsx    # Profile management
│   │   │   ├── ProfileForm.tsx    # Profile edit form
│   │   │   ├── DocumentUpload.tsx # CV/document upload
│   │   │   ├── DocumentList.tsx   # List uploaded documents
│   │   │   └── InterviewModal.tsx # AI phone interview modal
│   │   └── Settings/
│   │       └── SettingsPage.tsx   # Account settings & sign out
│   ├── contexts/
│   │   └── AuthContext.tsx        # Supabase auth context
│   ├── lib/
│   │   ├── supabase.ts            # Supabase client
│   │   └── database.types.ts      # TypeScript types for DB
│   ├── services/
│   │   ├── claude.ts              # Claude API client (calls Vercel)
│   │   ├── db.ts                  # Supabase database operations
│   │   ├── feedbackAnalyzer.ts    # Analysis client (calls Vercel)
│   │   ├── interviewGuideCache.ts # Interview guide caching
│   │   ├── jobScraper.ts          # URL scraping with CORS proxy
│   │   └── vapiInterview.ts       # Vapi client (calls Vercel)
│   ├── stores/
│   │   └── useStore.ts            # Zustand state (UI state only)
│   ├── types/
│   │   └── index.ts               # TypeScript interfaces
│   └── utils/
│       └── languageDetection.ts   # Detect Danish/English
└── vercel.json                    # Vercel configuration
```

## Database Schema (Supabase PostgreSQL)

```sql
-- Profiles (linked to Supabase Auth)
profiles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT,
  email TEXT,
  phone TEXT,
  location TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Documents
documents (
  id UUID PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id),
  name TEXT,
  type TEXT,  -- 'cv' | 'experience' | 'other'
  content TEXT,
  created_at TIMESTAMPTZ
)

-- Cover Letters
cover_letters (
  id UUID PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id),
  job_title TEXT,
  company_name TEXT,
  job_description TEXT,
  content TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Interview Results
interview_results (
  id UUID PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id),
  call_id TEXT,
  phone_number TEXT,
  status TEXT,  -- 'pending' | 'in-progress' | 'completed' | 'failed'
  transcript TEXT,
  summary TEXT,
  insights TEXT,
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)

-- Cached Interview Guides
interview_guides (
  id UUID PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id),
  guide JSONB,
  documents_hash TEXT,
  status TEXT,  -- 'generating' | 'ready' | 'failed'
  error TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

All tables have Row Level Security (RLS) policies ensuring users can only access their own data.

## Environment Variables

### Vercel (Server-side - Secret)
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
VAPI_API_KEY=...
VAPI_PHONE_NUMBER_ID=...
```

### Frontend (.env.local or Vercel)
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## Security Notes

### API Keys
- All API keys (Anthropic, Vapi) are stored server-side only
- Frontend never sees or handles API keys
- Vercel functions validate Supabase JWT before processing requests

### Authentication Flow
1. User signs up/in via Supabase Auth
2. Supabase returns JWT access token
3. Frontend includes token in Authorization header
4. Vercel functions verify token with Supabase
5. RLS policies enforce data isolation

### Row Level Security
- All database tables have RLS enabled
- Policies use `auth.uid()` to restrict access
- Users can only CRUD their own data

## Deployment

### Prerequisites
1. Supabase project created
2. Vercel account connected to GitHub repo

### Steps
1. **Supabase Setup:**
   - Create new project
   - Run `supabase/schema.sql` in SQL editor
   - Copy project URL and anon key

2. **Vercel Setup:**
   - Import GitHub repo
   - Add environment variables (both server and frontend)
   - Deploy

3. **Configure Auth:**
   - In Supabase dashboard, configure email auth
   - Optionally disable email confirmation for testing

## Configuration Notes

### Vapi Phone Interview
- Requires paid Vapi phone number for international calls
- Free US numbers only work for US calls
- Danish numbers recommended for Danish users (~$2-5/month)
- Interview guide is dynamically generated based on user's CV

### SEO
- robots.txt blocks all crawlers
- Meta robots tags: noindex, nofollow
- Site will not be indexed by search engines

## UI/UX Notes

- Cover letter display has no height limit (full content visible)
- URL scraper notes that public URLs required (LinkedIn won't work)
- Custom notes field allows user to direct AI (e.g., "focus on leadership experience")
- Feedback shown automatically after generation
- Loading states during auth check

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

## Migration History

### v2.0 - Supabase + Vercel Migration (2025-01-21)
- **Auth:** PIN-based → Supabase email/password
- **Database:** IndexedDB (Dexie) → Supabase PostgreSQL
- **API Keys:** Client-side env vars → Server-side Vercel functions
- **IDs:** Numeric auto-increment → UUID strings
- **Security:** Added RLS policies for multi-user data isolation

### v1.0 - Initial Release
- Client-side only application
- PIN-based local authentication
- IndexedDB for storage
- Direct API calls from browser
