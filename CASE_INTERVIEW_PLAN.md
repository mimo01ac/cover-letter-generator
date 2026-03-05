# Case Interview Prep Module - Implementation Plan

## Overview

A new module that lets users upload case materials (PDF, Word, text), optionally link to an existing interview briefing for full job context, and practice solving the case before seeing AI-suggested approaches.

**Core principle: Practice before reveal.** The user should be able to upload a case and immediately do a mock case interview with their own approach — without being biased by the AI's suggested solutions. The 3 solution approaches are generated on upload but **hidden by default** behind a "Reveal Solutions" button.

**Three pillars:**
1. **Case Upload** - Upload/paste case, optionally link to a briefing for job + company context
2. **Mock Case Interview** - Present your own approach via Vapi call, get structured feedback (available immediately after upload)
3. **Solution Reveal** - See 3 AI-generated approaches + framework breakdown (user chooses when to reveal)

---

## Architecture Decision: Separate Page (not a tab)

Case interviews are fundamentally different from behavioral interview prep. They deserve their own page at `/case-interview` with dedicated UI for case upload, framework analysis, and mock presentation.

**Why not a tab on InterviewPrepPage?**
- InterviewPrepPage is already complex (36KB, 6 tabs)
- Case interviews have their own primary input (uploaded case material)
- The workflow is different: upload case -> practice your approach -> optionally reveal solutions (vs. research company -> prep answers -> mock call)

**Briefing linkage:** Although it's a separate page, the user can optionally link a case to an existing interview briefing. This pulls in company research, industry analysis, job description, and competitive landscape — giving Claude full context to generate better analysis and the Vapi interviewer richer context for follow-up questions and feedback.

---

## Serverless Function Constraint (12/12 used)

**Critical:** We're at the Vercel Hobby limit. Strategy:

| New Functionality | How to Handle |
|---|---|
| Case analysis (Claude) | Consolidate into `/api/interview-prep/generate.ts` with `type: 'case-analysis'` |
| Mock case interview call | Reuse `/api/interview/start-call.ts` with `mode: 'case-interview'` |
| Case interview transcript processing | Reuse `/api/interview/process-transcript.ts` with `mode: 'case-interview'` |
| Case file parsing (PDF/Word) | Client-side parsing (already have `documentParser.ts`) |

**Result: Zero new serverless functions needed.**

---

## Phase 1: Case Upload & Analysis

### User Flow

1. User navigates to `/case-interview`
2. Uploads case material via:
   - File upload (PDF, Word .docx, .txt, .md)
   - Paste text directly
   - Or both (combine multiple sources)
3. **Optionally links to an existing interview briefing** (dropdown of previous briefings)
   - This gives the AI full context: company research, industry analysis, job description, competitive landscape
   - If linked, all analysis and feedback will be tailored to that specific role/company
   - If not linked, analysis is generic consulting best-practice
4. Clicks "Analyze Case"
5. Streaming response generates (runs in background, results stored in DB):
   - **Case Summary** - What the case is about (shown immediately)
   - **Framework Breakdown** - McKinsey-style structured decomposition (hidden)
   - **3 Solution Approaches** - Each with different strategic angle (hidden)
   - **Key Metrics & Data Points** - Numbers to reference (hidden)
   - **Potential Pitfalls** - Common mistakes to avoid (hidden)
6. After upload completes, user sees two paths:
   - **"Practice First"** - Go straight to mock case interview with your own approach
   - **"Reveal Solutions"** - See the AI's framework breakdown + 3 approaches

### Reveal Mechanic

The case summary is always visible (so the user confirms the case was parsed correctly), but the framework, approaches, metrics, and pitfalls are **hidden behind a confirmation dialog**:

> "Are you sure you want to reveal the suggested solutions? If you want to practice your own approach first, try the mock case interview before revealing."
> [Reveal Solutions] [Practice First]

Once revealed, the solutions stay visible. A flag `solutionsRevealed: boolean` tracks this per case analysis.

### Framework Methodology (Claude System Prompt)

The analysis prompt will instruct Claude to act as a senior McKinsey/BCG case coach using:

- **Issue Tree / MECE** - Mutually exclusive, collectively exhaustive problem decomposition
- **Hypothesis-driven approach** - Lead with a hypothesis, then validate
- **80/20 rule** - Focus on highest-impact drivers
- **Framework selection** - Profitability, market entry, M&A, pricing, growth strategy (pick what fits)
- **Quantitative structure** - Break down math, show calculation approach
- **Synthesis** - "So what?" at each level

### 3 Solution Approaches

Each approach presented as:
1. **Name & Strategic Angle** (e.g., "Cost Optimization Focus", "Market Expansion Play", "Portfolio Restructuring")
2. **Opening Structure** - How you'd frame the problem
3. **Key Analyses** - What you'd investigate
4. **Recommendation** - Expected conclusion direction
5. **Risk & Mitigation** - What could go wrong
6. **Why This Approach** - When it's the strongest choice

### Data Model

```typescript
interface CaseAnalysis {
  id: string;
  profileId: string;
  briefingId: string | null;        // Optional link to interview briefing for job/company context
  title: string;                    // User-provided or auto-generated
  caseContent: string;              // Raw uploaded text
  summary: string;                  // Case summary (always visible)
  framework: CaseFramework;         // Structured breakdown (hidden until revealed)
  approaches: CaseApproach[];       // 3 solution approaches (hidden until revealed)
  keyMetrics: string[];             // Important numbers/data (hidden until revealed)
  pitfalls: string[];               // Common mistakes (hidden until revealed)
  solutionsRevealed: boolean;       // Whether user has chosen to see the solutions
  status: 'analyzing' | 'ready' | 'error';
  createdAt: string;
  updatedAt: string;
}

interface CaseFramework {
  type: string;                     // e.g., "Profitability", "Market Entry"
  hypothesis: string;               // Initial hypothesis
  issueTree: IssueTreeNode[];       // MECE breakdown
  quantitativeAnchors: string[];    // Key calculations to perform
}

interface IssueTreeNode {
  branch: string;
  subBranches: string[];
  keyQuestions: string[];
}

interface CaseApproach {
  name: string;
  angle: string;
  openingStructure: string;
  keyAnalyses: string[];
  recommendation: string;
  risks: string[];
  bestWhen: string;
}
```

### Supabase Table

```sql
CREATE TABLE case_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  briefing_id UUID REFERENCES interview_briefings(id) ON DELETE SET NULL,  -- Optional link for job/company context
  title TEXT NOT NULL,
  case_content TEXT NOT NULL,
  summary TEXT,
  framework JSONB,
  approaches JSONB,
  key_metrics JSONB,
  pitfalls JSONB,
  solutions_revealed BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'analyzing',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE case_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own case analyses"
  ON case_analyses FOR ALL USING (auth.uid() = profile_id);
```

### File Parsing (Client-Side)

Extend existing `documentParser.ts` to support `.docx`:
- PDF: Already supported via pdf.js (existing)
- Word (.docx): Add `mammoth` library (lightweight, ~50KB gzipped)
- TXT/MD: Already supported (direct text read)

---

## Phase 2: Mock Case Interview

### User Flow

1. Available **immediately after case upload** (does NOT require revealing solutions)
2. User enters phone number (reuse existing phone input pattern)
3. Vapi calls user as "Sarah", a senior case interviewer
4. If a briefing is linked, Sarah has full company/role context and tailors her follow-up questions accordingly
5. Sarah asks the user to:
   - Structure the problem
   - Walk through their approach
   - Handle follow-up "drill-down" questions
   - Do quick mental math
   - Synthesize recommendation
6. Call ends, transcript processed
7. Structured feedback displayed

### Case Interview Persona (Vapi Prompt)

"Sarah" — Senior Partner at a top consulting firm conducting a case interview:
- Has full case material + (if linked) company research, industry analysis, job description
- Opens with the case prompt (from uploaded material)
- Lets candidate structure, then probes
- Asks 2-3 drill-down questions based on candidate's chosen path
- If briefing linked: probes with industry-specific follow-ups relevant to the target company
- Throws a curveball (new data point) mid-case
- Asks for final recommendation with "elevator pitch" synthesis
- Professional but challenging tone

### Feedback Structure

```typescript
interface CaseInterviewFeedback {
  overallScore: number;             // 1-10
  categoryScores: CaseCategoryScore[];
  structureAnalysis: {
    framework: string;              // What framework candidate used
    meceScore: number;              // How MECE was their breakdown
    comment: string;
  };
  communicationAnalysis: {
    clarity: number;
    topDown: number;                // Top-down communication score
    signposting: number;            // "First... Second... Third..."
    comment: string;
  };
  quantitativeAnalysis: {
    mathAccuracy: number;
    structuredApproach: number;     // Did they set up the math clearly
    comment: string;
  };
  synthesisFeedback: {
    actionable: number;             // Was recommendation actionable
    supported: number;              // Backed by analysis
    concise: number;                // Elevator-pitch quality
    comment: string;
  };
  industryRelevance?: {              // Only if briefing linked
    score: number;
    comment: string;                // How well they incorporated industry/company knowledge
  };
  strengths: string[];
  areasForImprovement: string[];
  actionItems: string[];            // Specific practice recommendations
  comparisonToApproaches?: string;  // Only shown after solutions are revealed
}

type CaseCategoryName =
  | 'Problem Structuring'
  | 'Quantitative Skills'
  | 'Business Judgment'
  | 'Communication'
  | 'Synthesis & Recommendation';

interface CaseCategoryScore {
  category: CaseCategoryName;
  score: number;
  comment: string;
}
```

### Reuse of Existing Infrastructure

| Component | Reuse | Changes Needed |
|---|---|---|
| `vapiInterview.ts` | Yes | Add `buildCaseInterviewPrompt()` |
| `/api/interview/start-call.ts` | Yes | Handle `mode: 'case-interview'` (just passes to Vapi) |
| `/api/interview/process-transcript.ts` | Yes | Add case-interview feedback schema in Claude prompt |
| `/api/interview/call-status.ts` | Yes | No changes (generic) |
| `interview_results` table | Yes | Add `mode: 'case-interview'`, feedback JSONB holds `CaseInterviewFeedback` |
| Phone number input pattern | Yes | Copy from MockInterview.tsx |

---

## New Files

```
src/
  components/
    CaseInterview/
      CaseInterviewPage.tsx          # Main page with upload + tabs
      CaseUpload.tsx                  # File upload + paste text component
      CaseAnalysisView.tsx           # Framework breakdown display
      CaseApproachCard.tsx           # Single approach card (x3)
      MockCaseInterview.tsx          # Vapi call component (mirrors MockInterview.tsx)
      CaseInterviewFeedback.tsx      # Feedback report (mirrors MockInterviewFeedbackReport.tsx)
      CaseHistory.tsx                # Previous case analyses list
  services/
    caseInterview.ts                 # API calls for case analysis + Vapi integration
```

## Modified Files

```
src/types/index.ts                   # Add CaseAnalysis, CaseInterviewFeedback types
src/App.tsx                          # Add /case-interview route
src/components/Layout/Navigation.tsx # Add nav link
src/services/vapiInterview.ts        # Add buildCaseInterviewPrompt()
src/services/documentParser.ts       # Add .docx support (mammoth)
api/interview-prep/generate.ts       # Add type: 'case-analysis' handler
api/interview/process-transcript.ts  # Add mode: 'case-interview' feedback schema
```

---

## UI Layout: CaseInterviewPage

```
+--------------------------------------------------+
| [Upload Case]  [Practice]  [Solutions]  [History] |  <- Tabs
+--------------------------------------------------+
|                                                    |
|  UPLOAD TAB:                                       |
|  +--------------------------------------------+   |
|  | Drop files here or click to upload          |   |
|  | (PDF, Word, TXT, DOCX)                     |   |
|  +--------------------------------------------+   |
|  | Or paste case text:                         |   |
|  | +----------------------------------------+ |   |
|  | |  [textarea]                            | |   |
|  | +----------------------------------------+ |   |
|  +--------------------------------------------+   |
|  | Link to briefing (optional):              |   |
|  | [v Select a briefing...              ]    |   |
|  |   - "McKinsey - Strategy Consultant"      |   |
|  |   - "BCG - Associate"                     |   |
|  |   - (none)                                |   |
|  +--------------------------------------------+   |
|  [ Analyze Case ]                                  |
|                                                    |
|  After upload, case summary shown + two CTAs:      |
|  +-- Case Summary (always visible) --+             |
|  | "Your client is a leading..."      |            |
|  +------------------------------------+            |
|  [ Practice Case Interview ]  [ Reveal Solutions ] |
|                                                    |
|  PRACTICE TAB (available immediately):             |
|  Phone: [+45 xxxxxxxx]                             |
|  [ Start Case Interview ]                          |
|  ... (feedback displayed after call)               |
|  If solutions not yet revealed, feedback omits     |
|  comparison to AI approaches                       |
|                                                    |
|  SOLUTIONS TAB:                                    |
|  If not revealed:                                  |
|  +--------------------------------------------+   |
|  | "Solutions are hidden so you can practice   |   |
|  |  your own approach first."                  |   |
|  | [ Reveal Solutions ]                        |   |
|  +--------------------------------------------+   |
|  If revealed:                                      |
|  +-- Framework ------+                             |
|  | Issue Tree (visual)                             |
|  +-- Approach 1 -----+-- Approach 2 --+-- Approach 3 --+
|  | Cost Focus        | Growth Play    | Restructure    |
|  | [Expand]          | [Expand]       | [Expand]       |
|  +-------------------+----------------+----------------+
|  +-- Key Metrics ----+-- Pitfalls ----+                |
+--------------------------------------------------+
```

---

## Implementation Order

### Step 1: Foundation (Types + DB + Route)
- Add types to `src/types/index.ts` (CaseAnalysis, CaseInterviewFeedback, etc.)
- Create Supabase migration for `case_analyses` table (with `briefing_id` FK + `solutions_revealed`)
- Add route in `App.tsx` and nav link in `Navigation.tsx`

### Step 2: Case Upload & Parsing
- Build `CaseUpload.tsx` with drag-and-drop + paste + briefing selector dropdown
- Add `.docx` support to `documentParser.ts` (add `mammoth` dep)
- Build `CaseInterviewPage.tsx` shell with 4 tabs (Upload, Practice, Solutions, History)

### Step 3: Case Analysis (Claude Integration)
- Add `type: 'case-analysis'` handler to `/api/interview-prep/generate.ts`
- If `briefingId` provided, fetch briefing and include company/industry context in Claude prompt
- Build streaming analysis with McKinsey framework prompt
- Store results in DB with `solutions_revealed: false`
- Create `caseInterview.ts` service

### Step 4: Mock Case Interview (Vapi) — Priority before Solutions UI
- Add `buildCaseInterviewPrompt()` to `vapiInterview.ts`
  - Include case content + briefing context (if linked)
  - Sarah persona has company/industry knowledge when briefing available
- Add 'case-interview' mode to `process-transcript.ts`
  - Feedback includes `industryRelevance` score when briefing is linked
  - `comparisonToApproaches` only populated if solutions already revealed
- Build `MockCaseInterview.tsx` (reuse patterns from MockInterview.tsx)
- Build `CaseInterviewFeedback.tsx`

### Step 5: Solutions Reveal UI
- Build `CaseAnalysisView.tsx` with reveal mechanic (confirmation dialog)
- Build `CaseApproachCard.tsx` (3 expandable cards)
- Update `solutions_revealed` flag in DB on reveal
- After reveal, re-process any existing mock interview feedback to add `comparisonToApproaches`

### Step 6: Case History
- Build `CaseHistory.tsx` (list previous analyses with briefing name if linked)
- Add DB functions to `db.ts` for case_analyses CRUD

### Step 7: Polish
- Loading states, error handling, empty states
- Mobile responsiveness
- PDF export of case analysis + feedback

---

## Dependencies to Add

| Package | Purpose | Size |
|---|---|---|
| `mammoth` | .docx to text conversion | ~50KB gzip |

That's it - everything else is already in the project.

---

## Estimated Scope

- ~8-10 new component files
- ~2-3 modified API handlers (no new serverless functions)
- 1 new Supabase table + migration
- 1 new npm dependency (mammoth)
- Reuses: Vapi, Supabase auth, Claude, SSE streaming, phone call infrastructure
