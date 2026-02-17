import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface LetterRefinementRequest {
  currentLetter: string;
  conversationHistory: ChatMessage[];
  userRequest: string;
  profile: {
    name: string;
    email: string;
    phone: string;
    location: string;
    summary: string;
  };
  documents: Array<{
    name: string;
    type: string;
    content: string;
  }>;
  jobDescription: string;
  language?: 'en' | 'da';
}

interface SummaryRefinementRequest {
  currentSummary: string;
  conversationHistory: ChatMessage[];
  userRequest: string;
  profile: {
    name: string;
    email: string;
    phone: string;
    location: string;
    summary: string;
  };
  documents: Array<{
    name: string;
    type: string;
    content: string;
  }>;
  jobTitle: string;
  jobDescription: string;
  language?: 'en' | 'da';
}

// --- Shared auth + streaming helpers ---

async function authenticateRequest(req: VercelRequest, supabaseUrl: string, supabaseKey: string) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Unauthorized', status: 401 };
  }

  const token = authHeader.slice(7);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { error: 'Unauthorized', status: 401 };
  }

  return { user, supabase };
}

async function streamAnthropicResponse(
  res: VercelResponse,
  anthropicKey: string,
  system: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  maxTokens: number = 4096
) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  try {
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: maxTokens,
      system,
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Claude API error:', error);
    res.write(`data: ${JSON.stringify({ error: 'Refinement failed' })}\n\n`);
    res.end();
  }
}

// --- Refine letter handler ---

async function handleRefine(req: VercelRequest, res: VercelResponse, anthropicKey: string, supabaseUrl: string, supabaseKey: string) {
  const auth = await authenticateRequest(req, supabaseUrl, supabaseKey);
  if ('error' in auth) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const body = req.body as LetterRefinementRequest;
  const { currentLetter, conversationHistory, userRequest, profile, documents, jobDescription, language = 'da' } = body;

  const cvContent = documents
    .map((doc) => `### ${doc.name} (${doc.type})\n${doc.content}`)
    .join('\n\n');

  const languageInstruction = language === 'da'
    ? 'Respond in Danish (Dansk).'
    : 'Respond in English.';

  const system = `You are an expert cover letter editor helping to refine and improve cover letters. ${languageInstruction}

## Context
You are helping ${profile.name} refine their cover letter.

## Candidate Profile
Name: ${profile.name}
Email: ${profile.email}
Phone: ${profile.phone}
Location: ${profile.location}

## Candidate Documents
${cvContent || 'No documents provided'}

## Job Description
${jobDescription}

## Current Cover Letter
${currentLetter}

## Instructions
- Make the requested changes to the cover letter
- Maintain the professional tone
- Keep the letter concise (300-400 words)
- Output ONLY the revised cover letter text
- Do not include explanations unless specifically asked`;

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userRequest },
  ];

  await streamAnthropicResponse(res, anthropicKey, system, messages);
}

// --- Refine summary handler ---

async function handleRefineSummary(req: VercelRequest, res: VercelResponse, anthropicKey: string, supabaseUrl: string, supabaseKey: string) {
  const auth = await authenticateRequest(req, supabaseUrl, supabaseKey);
  if ('error' in auth) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const body = req.body as SummaryRefinementRequest;
  const { currentSummary, conversationHistory, userRequest, profile, documents, jobTitle, jobDescription, language = 'en' } = body;

  const cvContent = documents
    .map((doc) => `### ${doc.name} (${doc.type})\n${doc.content}`)
    .join('\n\n');

  const languageInstruction = language === 'da'
    ? 'Respond in Danish (Dansk).'
    : 'Respond in English.';

  const system = `You are an expert CV writer helping to refine executive summaries for CVs. ${languageInstruction}

## Context
You are helping ${profile.name} refine their executive summary for a ${jobTitle} position.

## Candidate Profile
Name: ${profile.name}
Email: ${profile.email}
Phone: ${profile.phone}
Location: ${profile.location}

## Candidate Documents
${cvContent || 'No documents provided'}

## Job Description
${jobDescription}

## Current Executive Summary
${currentSummary}

## Expected Format
The executive summary has two parts:
1. **Professional Headline:** A pipe-separated headline (e.g., "Executive Leader in Revenue Operations | CRM & AI Enablement | Commercial Excellence")
2. **Summary Paragraph:** 3-5 sentences, max 100 words

## Instructions
- Make the requested changes to the executive summary
- Preserve the two-part format (headline + summary paragraph)
- Keep the summary concise (3-5 sentences, max 100 words)
- Focus on qualifications most relevant to the target role
- Use active voice and impactful language
- Include quantifiable achievements when available
- Avoid generic phrases like "results-driven professional"
- Output ONLY the revised headline and summary (headline first, blank line, then summary)
- Do not include explanations unless specifically asked`;

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userRequest },
  ];

  await streamAnthropicResponse(res, anthropicKey, system, messages, 500);
}

// --- Main router ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!anthropicKey || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const action = req.query.action as string;

  switch (action) {
    case 'refine':
      return handleRefine(req, res, anthropicKey, supabaseUrl, supabaseKey);
    case 'summary':
      return handleRefineSummary(req, res, anthropicKey, supabaseUrl, supabaseKey);
    default:
      return res.status(400).json({ error: 'Invalid action. Use ?action=refine or ?action=summary' });
  }
}
