import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface GenerationRequest {
  type?: 'interview-prep' | 'case-analysis';
  profileId: string;
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  companyUrl?: string;
  documents?: Array<{
    name: string;
    type: string;
    content: string;
  }>;
  profile?: {
    name: string;
    summary: string;
  };
  // Case analysis fields
  title?: string;
  caseContent?: string;
  briefingId?: string | null;
}

interface ResearchData {
  companyResearch: unknown;
  industryAnalysis: unknown;
  competitiveLandscape: unknown;
}

// Prompts for each generation phase
const BRIEFING_SYSTEM_PROMPT = `You are an expert career coach preparing a candidate for a job interview. Create a comprehensive briefing document that will help the candidate understand the company, role, and how to position themselves effectively.

Your briefing should include:

## Company Overview
- Company mission, values, and culture
- Recent news and developments
- Key leadership and organizational structure
- Business model and revenue streams

## Role Analysis
- Key responsibilities and expectations
- Required skills and how the candidate matches
- Potential challenges in the role
- Growth opportunities

## Industry Context
- Current trends affecting the industry
- Regulatory considerations
- Competitive landscape

## Strategic Positioning
- How the candidate's experience aligns with company needs
- Unique value proposition they can offer
- Potential concerns and how to address them

Write in a clear, actionable style. Be specific and reference actual details from the provided information.`;

const QUESTIONS_SYSTEM_PROMPT = `You are an expert interview coach. Generate 12-15 interview questions the candidate is likely to face, along with suggested answers tailored to their background.

Organize questions into these categories:
1. **Behavioral** - Past experiences and how they handled situations
2. **Technical/Role-specific** - Skills and knowledge for the specific role
3. **Situational** - Hypothetical scenarios they might face
4. **Company-specific** - Questions about the company, culture, and industry
5. **Career/Motivational** - Why this role, career goals, etc.

For each question, provide:
- The question itself
- A suggested answer framework using the candidate's actual experience
- Tips for delivering the answer effectively

Return as a JSON array with this structure:
[
  {
    "category": "behavioral|technical|situational|company-specific|role-specific",
    "question": "the interview question",
    "suggestedAnswer": "a well-crafted answer using the candidate's background",
    "tips": "delivery tips or things to emphasize"
  }
]

IMPORTANT: Only use facts and experiences from the provided candidate documents. Never invent achievements or experiences.`;

const TALKING_POINTS_SYSTEM_PROMPT = `You are an expert interview coach. Extract and format the candidate's most compelling experiences as STAR-format stories they can use in interviews.

For each talking point, identify:
- **Situation**: The context or background
- **Task**: What needed to be accomplished
- **Action**: Specific steps the candidate took
- **Result**: The outcome, preferably with metrics

Select 5-8 stories that best demonstrate:
- Leadership and influence
- Problem-solving and innovation
- Technical expertise
- Collaboration and teamwork
- Results and impact

Return as a JSON array with this structure:
[
  {
    "situation": "brief context",
    "task": "the challenge or goal",
    "action": "what the candidate did",
    "result": "the outcome with metrics if available",
    "relevantFor": ["leadership questions", "problem-solving", "etc"]
  }
]

CRITICAL: Only extract stories that are explicitly described in the candidate documents. Do not invent or embellish experiences.`;

const PODCAST_SYSTEM_PROMPT = `You are a professional podcast host creating an audio briefing for a job candidate. Write a conversational script that the candidate can listen to while commuting or preparing for their interview.

The script should be:
- 3000-4000 words (about 15-20 minutes when read aloud)
- Conversational and engaging, as if speaking directly to the candidate
- Structured with clear sections but flowing naturally
- Actionable with specific tips and reminders

Structure:
1. **Opening** (1 min) - Welcome and what we'll cover
2. **Company Deep Dive** (4 min) - Everything they need to know about the company
3. **Role Breakdown** (3 min) - What the role entails and why they're a fit
4. **Key Talking Points** (5 min) - Their strongest stories and how to tell them
5. **Likely Questions** (4 min) - What to expect and how to answer
6. **Final Prep Tips** (2 min) - Day-of advice and confidence boosters
7. **Closing** (1 min) - Good luck message

Write naturally with occasional pauses indicated by "..." and emphasis with *asterisks*. Use "you" and "your" to address the candidate directly.`;

const CASE_ANALYSIS_SYSTEM_PROMPT = `You are a senior executive coach and strategy advisor with 15+ years advising C-suite leaders and board members. You specialize in preparing candidates for take-home and pre-read strategic case interviews.

## Context
The candidate has received a strategic case brief before their interview — the kind of pre-read case where a company asks "You are the new CCO — market share has been declining for 3 years. What is your plan for the first 90 days?" or "As incoming VP of Operations, how would you restructure the supply chain?" These are HIGH-LEVEL STRATEGIC cases, NOT back-of-envelope market sizing, brainteaser calculations, or live case-cracking exercises.

## Your Analysis Approach
Think like a senior executive preparing a board presentation:
- Strategic priorities and sequencing (what to do first, second, third)
- Stakeholder management (board, team, customers, partners)
- Quick wins vs. long-term structural changes
- Risk assessment and contingency planning
- Measurable success metrics and milestones
- Execution realism — what can actually be done in the timeframe
- Leadership narrative — the "story" that ties it all together

Return your analysis as a JSON object with this exact structure (no markdown, no code fences, just raw JSON):
{
  "summary": "2-3 sentence case overview focusing on the strategic challenge",
  "framework": {
    "type": "Strategic framework name (e.g., 90-Day Plan, Turnaround Strategy, Growth Acceleration, Organizational Transformation, Market Repositioning)",
    "hypothesis": "Core strategic thesis — what you believe the right direction is and why",
    "issueTree": [
      {
        "branch": "Strategic priority area (e.g., Diagnose & Assess, Quick Wins, Structural Changes, Stakeholder Alignment)",
        "subBranches": ["Specific initiative or action"],
        "keyQuestions": ["Key question to investigate or validate"]
      }
    ],
    "quantitativeAnchors": ["Key metric, target, or benchmark to anchor the strategy"]
  },
  "approaches": [
    {
      "name": "Strategy name (e.g., Aggressive Turnaround, Measured Transformation, Stakeholder-First Approach)",
      "angle": "Brief description of the strategic philosophy",
      "openingStructure": "How to open your presentation — the strategic narrative in the first 2 minutes",
      "keyAnalyses": ["Key strategic move 1", "Key strategic move 2", "Key strategic move 3"],
      "recommendation": "The headline recommendation and expected outcomes",
      "risks": ["Key risk or pushback to anticipate"],
      "bestWhen": "When this approach is the strongest choice (e.g., risk tolerance, organizational culture, time pressure)"
    }
  ],
  "keyMetrics": ["Important data point, benchmark, or target from the case"],
  "pitfalls": ["Common strategic mistake to avoid in this specific case"]
}

IMPORTANT:
- Generate exactly 3 approaches with distinctly different strategic philosophies (e.g., aggressive vs. measured vs. stakeholder-first)
- Each approach should be a credible executive strategy — not a textbook framework exercise
- Focus on WHAT to do and WHY, not generic consulting frameworks
- Key metrics should reference actual data from the case brief
- Pitfalls should be specific to this case — things that would make a candidate look junior or naive
- If company/industry context is provided, tailor everything to that specific business reality
- Think about what would impress a hiring panel of senior executives, not a consulting interviewer`;

async function handleCaseAnalysis(
  body: GenerationRequest,
  supabase: SupabaseClient,
  token: string,
  req: VercelRequest,
  res: VercelResponse
) {
  const { profileId, title, caseContent, briefingId } = body;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey || !caseContent || !title) {
    return res.status(400).json({ error: 'Missing required fields for case analysis' });
  }

  // Set up streaming response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (type: string, data: unknown) => {
    res.write(`data: ${JSON.stringify({ type, ...data as object })}\n\n`);
  };

  try {
    sendEvent('status', { phase: 'analyzing', message: 'Analyzing case material...' });

    // Fetch linked briefing context if available
    let briefingContext = '';
    if (briefingId) {
      const { data: briefing } = await (supabase
        .from('interview_briefings') as ReturnType<typeof supabase.from>)
        .select('job_title, company_name, job_description, company_research, industry_analysis, competitive_landscape')
        .eq('id', briefingId)
        .single();

      if (briefing) {
        const b = briefing as Record<string, unknown>;
        briefingContext = `
## Company & Role Context (tailor your analysis to this specific company and industry)
- Company: ${b.company_name}
- Role: ${b.job_title}
- Job Description: ${b.job_description}
- Company Research: ${b.company_research ? JSON.stringify(b.company_research) : 'N/A'}
- Industry Analysis: ${b.industry_analysis ? JSON.stringify(b.industry_analysis) : 'N/A'}
- Competitive Landscape: ${b.competitive_landscape ? JSON.stringify(b.competitive_landscape) : 'N/A'}`;
      }
    }

    // Create case_analyses record
    const { data: caseRecord, error: insertError } = await (supabase
      .from('case_analyses') as ReturnType<typeof supabase.from>)
      .insert({
        profile_id: profileId,
        briefing_id: briefingId || null,
        title,
        case_content: caseContent,
        status: 'analyzing',
      } as Record<string, unknown>)
      .select('id')
      .single();

    if (insertError || !caseRecord) {
      console.error('Failed to create case analysis record:', insertError);
      sendEvent('error', { message: 'Failed to create case analysis record' });
      res.end();
      return;
    }

    const caseId = (caseRecord as { id: string }).id;
    sendEvent('case_id', { id: caseId });

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    // Generate summary first (streamed)
    sendEvent('status', { phase: 'summarizing', message: 'Generating case summary...' });

    const summaryStream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: `Summarize this case in 2-3 clear sentences. What is the core business problem?${briefingContext ? `\n\nContext: This case is for an interview at a specific company.${briefingContext}` : ''}\n\n## Case Material\n${caseContent}`,
      }],
    });

    let summary = '';
    for await (const event of summaryStream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        summary += event.delta.text;
        sendEvent('summary', { text: event.delta.text });
      }
    }
    sendEvent('summary_done', {});

    // Generate full analysis (framework + 3 approaches)
    sendEvent('status', { phase: 'analyzing', message: 'Building framework and solution approaches...' });

    const analysisResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      temperature: 0.3,
      system: CASE_ANALYSIS_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `${briefingContext ? briefingContext + '\n\n' : ''}## Case Material\n${caseContent}\n\n## Case Summary\n${summary}\n\nAnalyze this case and return the JSON analysis.`,
      }],
    });

    let analysisJson = '';
    for (const block of analysisResponse.content) {
      if (block.type === 'text') analysisJson += block.text;
    }

    // Parse the analysis JSON
    let analysis;
    try {
      let jsonText = analysisJson.trim();
      if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7);
      else if (jsonText.startsWith('```')) jsonText = jsonText.slice(3);
      if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);
      analysis = JSON.parse(jsonText.trim());
    } catch (parseError) {
      console.error('Failed to parse case analysis JSON:', parseError);
      console.error('Raw response:', analysisJson.substring(0, 500));
      // Try to salvage what we can
      analysis = { framework: null, approaches: [], keyMetrics: [], pitfalls: [] };
    }

    // Save complete analysis to DB
    const { error: updateError } = await (supabase
      .from('case_analyses') as ReturnType<typeof supabase.from>)
      .update({
        summary,
        framework: analysis.framework || null,
        approaches: analysis.approaches || [],
        key_metrics: analysis.keyMetrics || [],
        pitfalls: analysis.pitfalls || [],
        status: 'ready',
      } as Record<string, unknown>)
      .eq('id', caseId);

    if (updateError) {
      console.error('Failed to update case analysis:', updateError);
    }

    sendEvent('status', { phase: 'complete', message: 'Case analysis ready!' });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Case analysis error:', error);
    const message = error instanceof Error ? error.message : 'Case analysis failed';
    if (!res.headersSent) {
      return res.status(500).json({ error: message });
    }
    sendEvent('error', { message });
    res.end();
  }
}

async function callResearchEndpoint(
  companyName: string,
  industry: string | undefined,
  companyUrl: string | undefined,
  baseUrl: string,
  token: string
): Promise<ResearchData | null> {
  try {
    const response = await fetch(`${baseUrl}/api/interview-prep/research`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ companyName, industry, companyUrl }),
    });

    if (!response.ok) {
      console.error('Research endpoint failed:', response.status);
      return null;
    }

    return await response.json() as ResearchData;
  } catch (error) {
    console.error('Failed to call research endpoint:', error);
    return null;
  }
}

function buildCandidateContext(
  profile: { name: string; summary: string },
  documents: Array<{ name: string; type: string; content: string }>
): string {
  let context = `<candidate>\nName: ${profile.name}\n`;

  if (profile.summary) {
    context += `\nProfessional Summary:\n${profile.summary}\n`;
  }

  for (const doc of documents) {
    if (doc.content?.trim()) {
      context += `\n--- ${doc.name} (${doc.type}) ---\n${doc.content}\n`;
    }
  }

  context += '</candidate>';
  return context;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!anthropicKey) {
    return res.status(500).json({ error: 'Server configuration error: Missing API key' });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server configuration error: Missing database config' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body as GenerationRequest;

    // Route to case analysis if type specified
    if (body.type === 'case-analysis') {
      return handleCaseAnalysis(body, supabase, token, req, res);
    }

    const { profileId, jobTitle, companyName, jobDescription, companyUrl, documents, profile } = body;

    // Set up streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Helper to send SSE events
    const sendEvent = (type: string, data: unknown) => {
      res.write(`data: ${JSON.stringify({ type, ...data as object })}\n\n`);
    };

    // Phase 1: Research
    sendEvent('status', { phase: 'researching', message: 'Researching company and industry...' });

    // Get the base URL for internal API calls
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    const researchData = await callResearchEndpoint(companyName, undefined, companyUrl, baseUrl, token);

    // Save initial briefing record
    const { data: briefingRecord, error: insertError } = await supabase
      .from('interview_briefings')
      .insert({
        profile_id: profileId,
        job_title: jobTitle,
        company_name: companyName,
        job_description: jobDescription,
        company_url: companyUrl || null,
        company_research: researchData?.companyResearch || null,
        industry_analysis: researchData?.industryAnalysis || null,
        competitive_landscape: researchData?.competitiveLandscape || null,
        status: 'generating',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to create briefing record:', insertError);
      sendEvent('error', { message: 'Failed to create briefing record' });
      res.end();
      return;
    }

    const briefingId = briefingRecord.id;
    sendEvent('briefing_id', { id: briefingId });

    // Build context for AI
    const candidateContext = buildCandidateContext(profile, documents);
    const researchContext = researchData
      ? `<research>
Company Research: ${JSON.stringify(researchData.companyResearch, null, 2)}
Industry Analysis: ${JSON.stringify(researchData.industryAnalysis, null, 2)}
Competitive Landscape: ${JSON.stringify(researchData.competitiveLandscape, null, 2)}
</research>`
      : '<research>No external research available. Use your knowledge of the company and industry.</research>';

    const jobContext = `<job>
Job Title: ${jobTitle}
Company: ${companyName}
${companyUrl ? `Company URL: ${companyUrl}` : ''}

Job Description:
${jobDescription}
</job>`;

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    // Phase 2: Generate Briefing Document
    sendEvent('status', { phase: 'generating', message: 'Generating briefing document...' });

    const briefingStream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.3,
      system: BRIEFING_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `${jobContext}\n\n${researchContext}\n\n${candidateContext}\n\nCreate a comprehensive interview briefing document for this candidate.`,
      }],
    });

    let briefingDocument = '';
    for await (const event of briefingStream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        briefingDocument += event.delta.text;
        sendEvent('briefing', { text: event.delta.text });
      }
    }
    sendEvent('briefing_done', {});

    // Save briefing document immediately
    await supabase
      .from('interview_briefings')
      .update({ briefing_document: briefingDocument })
      .eq('id', briefingId);

    // Phase 3: Generate Interview Questions
    sendEvent('status', { phase: 'generating', message: 'Generating interview questions...' });

    const questionsResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.3,
      system: QUESTIONS_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `${jobContext}\n\n${researchContext}\n\n${candidateContext}\n\nGenerate interview questions with suggested answers for this candidate.`,
      }],
    });

    let questionsJson = '';
    for (const block of questionsResponse.content) {
      if (block.type === 'text') {
        questionsJson += block.text;
      }
    }

    // Parse questions JSON
    let interviewQuestions = [];
    try {
      // Extract JSON from response
      let jsonText = questionsJson.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7);
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3);
      }
      interviewQuestions = JSON.parse(jsonText.trim());
    } catch (error) {
      console.error('Failed to parse questions JSON:', error);
      interviewQuestions = [];
    }

    sendEvent('questions', { data: interviewQuestions });

    // Save questions immediately
    await supabase
      .from('interview_briefings')
      .update({ interview_questions: interviewQuestions })
      .eq('id', briefingId);

    // Phase 4: Generate Talking Points
    sendEvent('status', { phase: 'generating', message: 'Extracting talking points...' });

    const talkingPointsResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.3,
      system: TALKING_POINTS_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `${candidateContext}\n\n${jobContext}\n\nExtract STAR-format talking points from this candidate's experience that are relevant for this role.`,
      }],
    });

    let talkingPointsJson = '';
    for (const block of talkingPointsResponse.content) {
      if (block.type === 'text') {
        talkingPointsJson += block.text;
      }
    }

    // Parse talking points JSON
    let talkingPoints = [];
    try {
      let jsonText = talkingPointsJson.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7);
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3);
      }
      talkingPoints = JSON.parse(jsonText.trim());
    } catch (error) {
      console.error('Failed to parse talking points JSON:', error);
      talkingPoints = [];
    }

    sendEvent('talking_points', { data: talkingPoints });

    // Save talking points immediately
    await supabase
      .from('interview_briefings')
      .update({ talking_points: talkingPoints })
      .eq('id', briefingId);

    // Phase 5: Generate Podcast Script
    sendEvent('status', { phase: 'generating', message: 'Creating podcast script...' });

    const podcastStream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      temperature: 0.4,
      system: PODCAST_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `${jobContext}\n\n${researchContext}\n\n${candidateContext}\n\n<briefing_summary>\n${briefingDocument.substring(0, 2000)}...\n</briefing_summary>\n\nCreate an engaging podcast-style audio briefing script for this candidate preparing for their interview.`,
      }],
    });

    let podcastScript = '';
    for await (const event of podcastStream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        podcastScript += event.delta.text;
        sendEvent('podcast', { text: event.delta.text });
      }
    }
    sendEvent('podcast_done', {});

    // Save podcast script and mark as ready
    const { error: updateError } = await supabase
      .from('interview_briefings')
      .update({
        podcast_script: podcastScript,
        status: 'ready',
      })
      .eq('id', briefingId);

    if (updateError) {
      console.error('Failed to update briefing record:', updateError);
    }

    sendEvent('status', { phase: 'complete', message: 'Briefing pack ready!' });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Generate API error:', error);
    const message = error instanceof Error ? error.message : 'Generation failed';

    if (!res.headersSent) {
      return res.status(500).json({ error: message });
    }

    res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
    res.end();
  }
}
