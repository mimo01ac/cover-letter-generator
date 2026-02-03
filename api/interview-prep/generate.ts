import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface GenerationRequest {
  profileId: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  companyUrl?: string;
  documents: Array<{
    name: string;
    type: string;
    content: string;
  }>;
  profile: {
    name: string;
    summary: string;
  };
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
