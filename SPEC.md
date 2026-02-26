# SPEC — Cover Letter Generator

> What the product does, for whom, and at what scope.

## Goals

1. **Eliminate blank-page syndrome** — generate a strong first draft of a cover letter from a job description and the user's documents
2. **Tailor CVs per application** — produce a job-matched CV with the right template and emphasis
3. **Prepare candidates for interviews** — provide company research, tailored questions, STAR stories, and audio briefings
4. **Simulate real interviews** — conduct AI-powered mock phone screens and deliver actionable performance feedback
5. **Keep everything in one place** — profile, documents, cover letters, CVs, and interview prep linked per job

## Users

Single persona: **job seekers** applying to multiple roles who want AI assistance writing application materials and preparing for interviews. Primarily Danish and English speakers.

## Features

### 1. Profile & Documents
- Email/password auth (Supabase)
- One profile per user with name, email, phone, location, summary
- Upload multiple documents: CV, experience notes, certifications
- Documents parsed and used as context for all AI features

### 2. Cover Letter Generation
- Input: job title, company name, job description (paste or scrape from URL)
- Auto-detect language (Danish / English)
- Streaming generation with executive summary
- Anti-hallucination fact extraction (skills, achievements, credentials)
- Feedback: match score, keyword gaps, improvement suggestions
- Iterative refinement via chat

### 3. CV Tailoring
- Input: same job context as cover letter
- Templates: Classic, Hybrid, Executive
- Generates structured CV data: headline, summary, highlights, competencies, experience, education
- Live preview in the browser
- PDF export via jsPDF
- Save package: CV (.docx + .pdf) + cover letter (.docx) + job listing (.pdf) → local folder or ZIP

### 4. Interview Preparation
- Input: job title, company name, job description, optional company URL
- Phases:
  1. **Company research** — mission, values, culture, news, key people, competitive landscape
  2. **Briefing document** — comprehensive company and role analysis
  3. **Interview questions** — 12–15 questions across behavioral, technical, situational, company-specific, role-specific categories with suggested answers
  4. **STAR talking points** — situation/task/action/result stories from the user's documents
  5. **Podcast script** — conversational audio briefing script
  6. **Audio generation** — TTS podcast for on-the-go listening
- All content saved to Supabase; briefing history with reload

### 5. Mock Interview
- Requires an existing briefing (company research + questions)
- AI recruiter "Alex" calls the user's phone via Vapi.ai
- Recruiter persona uses company research, interview questions, and candidate CV
- Stays in character — no coaching during the call
- Post-call: transcript processed by Claude to generate structured feedback:
  - Overall score (1–10)
  - Category scores: Communication, Technical, Cultural Fit, Problem-Solving, Pressure Handling
  - Per-question breakdown: candidate response, score, what went well, what to improve, suggested better answer
  - Strengths, areas for improvement, action items
- Multiple attempts tracked per briefing with score history

### 6. Career Interview (Profile Insights)
- AI phone interview to extract professional stories and achievements
- Insights saved as an experience document for richer cover letter context

## Out of Scope (Current Phase)

- Multi-user collaboration or team accounts
- OAuth / social login providers
- Resume parsing from PDF layout (uses text extraction only)
- Real-time collaborative editing
- Payment / subscription billing
- Mobile native app
- Interview scheduling with real companies

## Constraints

- **Vercel Hobby plan**: 12 serverless functions max — new endpoints must consolidate into existing ones
- **PDF generation**: Must use jsPDF text API, not html2canvas (Tailwind v4 oklch colors crash it)
- **File System Access API**: Works on local folders only, not cloud-synced folders (Google Drive, iCloud, etc.) — falls back to ZIP

## References

- [README.md](README.md) — setup, usage, and deployment
- [PLAN.md](PLAN.md) — architecture and technical decisions
