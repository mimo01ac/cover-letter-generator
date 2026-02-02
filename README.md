# Cover Letter Generator

A React web application for creating personalized cover letters using AI. Features profile management, CV upload, AI-powered cover letter generation with anti-hallucination safeguards, feedback analysis, and an AI phone interview feature.

## Features

- **Profile Management**: Store your personal information and upload documents (CV, experience notes)
- **AI Cover Letter Generation**: Uses Anthropic's Claude API with streaming responses
- **Executive Summary Generation**: Automatically generates a tailored CV executive summary alongside each cover letter
- **Summary Refinement**: Chat interface with quick actions to iteratively refine your executive summary
- **Anti-Hallucination System**: Pre-extracts verified facts from your documents to prevent fabricated claims
- **Feedback Analysis**: Automatic match score, improvement suggestions, and keyword analysis
- **Iterative Refinement**: Chat interface to refine the generated letter with follow-up requests
- **Job URL Scraping**: Automatically extract job descriptions from URLs (supports jobindex.dk and other public job postings)
- **AI Phone Interview**: Vapi.ai-powered phone interviews that analyze your CV and generate personalized insights
- **Multi-language Support**: Detects Danish/English and generates appropriate cover letters
- **Secure Authentication**: Email/password authentication via Supabase Auth with password reset
- **Cloud Storage**: All data securely stored in Supabase PostgreSQL with Row Level Security

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 7
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (email/password with password reset)
- **Backend**: Vercel Serverless Functions
- **AI**: Anthropic Claude API (server-side)
  - Claude 3.5 Haiku for fact extraction
  - Claude Sonnet 4 for cover letter generation
- **Voice Interview**: Vapi.ai (server-side)

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

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Vercel account (for deployment)
- Anthropic API key
- Vapi.ai API key (optional, for phone interviews)

### Local Development

```bash
# Clone the repository
git clone https://github.com/mimo01ac/cover-letter-generator.git
cd cover-letter-generator

# Install dependencies
npm install

# Create .env.local file (see Environment Variables section)

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

## Environment Variables

### Frontend (.env.local)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Vercel (Server-side)

Set these in Vercel dashboard under Environment Variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
VAPI_API_KEY=...              (optional)
VAPI_PHONE_NUMBER_ID=...      (optional)
```

## Deployment

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema from `supabase/schema.sql`
3. Copy your project URL and anon key from Settings > API

### 2. Vercel Setup

1. Import your GitHub repository at [vercel.com](https://vercel.com)
2. Add environment variables (see above)
3. Deploy

### 3. Configure Authentication

1. In Supabase dashboard, go to Authentication > Providers
2. Ensure Email provider is enabled
3. Optionally disable email confirmation for testing
4. Customize email templates (Auth > Email Templates) to brand your password reset emails

## Usage

1. **Create an account**: Sign up with email and password

2. **Set up your profile**: Go to Profile and fill in your information (click "Create Profile to Continue")

3. **Upload documents**: Upload your CV and any relevant experience documents

4. **Generate a cover letter**:
   - Go to the Generate page
   - Enter a job URL or paste the job description
   - Optionally add custom notes for the AI
   - Click "Generate Cover Letter"

5. **Review feedback**: See your match score and improvement suggestions

6. **Refine your letter**: Use the chat interface to make adjustments

7. **Refine your executive summary**: Use quick actions or custom requests to perfect your CV summary

7. **AI Interview** (optional): Start an AI phone interview for deeper insights

8. **Reset password**: Click "Forgot password?" on the login page if needed

## Project Structure

```
├── api/                           # Vercel serverless functions
│   ├── cover-letter/
│   │   ├── generate.ts            # Generate cover letter + summary (streaming) + fact extraction
│   │   ├── refine.ts              # Refine letter via chat (streaming)
│   │   ├── refine-summary.ts      # Refine executive summary via chat (streaming)
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
│   │   ├── Auth/                  # Login/signup/forgot password/reset password
│   │   ├── Layout/                # App shell, navigation
│   │   ├── Profile/               # Profile form, document upload, interview
│   │   ├── CoverLetter/           # Generation, refinement, summary refinement, history, feedback
│   │   └── Settings/              # Account settings
│   ├── contexts/
│   │   └── AuthContext.tsx        # Supabase auth context
│   ├── lib/
│   │   ├── supabase.ts            # Supabase client
│   │   └── database.types.ts      # TypeScript types for DB
│   ├── services/
│   │   ├── claude.ts              # Claude API client
│   │   ├── db.ts                  # Supabase database operations
│   │   ├── feedbackAnalyzer.ts    # Analysis client
│   │   ├── jobScraper.ts          # URL scraping
│   │   └── vapiInterview.ts       # Vapi client
│   ├── stores/
│   │   └── useStore.ts            # Zustand state (UI state)
│   └── types/
│       └── index.ts               # TypeScript interfaces
└── vercel.json                    # Vercel configuration
```

## Security

- **API Keys**: All API keys (Anthropic, Vapi) are stored server-side only
- **Authentication**: JWT-based sessions via Supabase Auth with password reset support
- **Data Isolation**: Row Level Security ensures users only access their own data
- **Anti-Hallucination**: Fact extraction prevents fabricated claims in cover letters
- **No Indexing**: Site is configured with noindex/nofollow meta tags

## Anti-Hallucination System

The cover letter generator includes safeguards against AI hallucinations:

1. **Fact Extraction**: Before generating, Claude Haiku extracts verified facts from your documents:
   - Skills (with confidence levels: explicit/demonstrated/mentioned)
   - Achievements (with exact metrics only if present)
   - Credentials (degrees, certifications, job titles)
   - Companies worked at

2. **Strict Claim Rules**: The generation prompt enforces:
   - Every skill claim must exist in the fact inventory
   - No fabricated metrics or percentages
   - No superlatives ("expert", "extensive") without supporting evidence
   - No degrees or certifications not in your documents

3. **Cost**: ~$0.001 per extraction (~5% increase in API costs)

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Troubleshooting

### Authentication Issues

If you can't sign in:
1. Check that Supabase URL and anon key are correct in `.env.local`
2. Ensure the Email provider is enabled in Supabase Auth settings
3. Check browser console for specific error messages

### Forgot Password Not Working

1. Check that the password reset email template is configured in Supabase
2. Verify the redirect URL in AuthContext.tsx matches your domain
3. Check spam folder for reset emails

### Cover Letter Generation Fails

1. Verify `ANTHROPIC_API_KEY` is set correctly in Vercel
2. Check Vercel function logs for errors
3. Ensure you have credits on your Anthropic account

### Interview Feature Not Working

1. Verify `VAPI_API_KEY` and `VAPI_PHONE_NUMBER_ID` are set in Vercel
2. International calls require a paid Vapi phone number
3. Check Vercel function logs for specific errors

### Profile/Document Save Fails

1. Ensure you've created a profile before uploading documents
2. Check browser console for Supabase error messages
3. Verify the schema has been applied in Supabase SQL Editor

### PDF Parsing Issues

If PDF text extraction fails:
1. Copy and paste the text directly from your PDF
2. Save your CV as a `.txt` file first
3. Use the "Paste Text" option instead of file upload

## License

Private - All rights reserved
