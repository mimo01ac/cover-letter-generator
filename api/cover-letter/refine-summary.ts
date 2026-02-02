import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check required environment variables (support both VITE_ prefixed and non-prefixed)
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!anthropicKey || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Verify auth token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);

  const supabase = createClient(
    supabaseUrl,
    supabaseKey,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body as SummaryRefinementRequest;
  const { currentSummary, conversationHistory, userRequest, profile, documents, jobTitle, jobDescription, language = 'en' } = body;

  const cvContent = documents
    .map((doc) => `### ${doc.name} (${doc.type})\n${doc.content}`)
    .join('\n\n');

  const languageInstruction =
    language === 'da'
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

## Instructions
- Make the requested changes to the executive summary
- Keep it concise (3-5 sentences, max 100 words)
- Focus on qualifications most relevant to the target role
- Use active voice and impactful language
- Include quantifiable achievements when available
- Avoid generic phrases like "results-driven professional"
- Output ONLY the revised executive summary text
- Do not include explanations unless specifically asked`;

  const anthropic = new Anthropic({
    apiKey: anthropicKey,
  });

  // Build messages from conversation history
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userRequest },
  ];

  // Set up streaming response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
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
