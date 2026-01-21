import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RefinementRequest {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify auth token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
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

  const body = req.body as RefinementRequest;
  const { currentLetter, conversationHistory, userRequest, profile, documents, jobDescription, language = 'da' } = body;

  const cvContent = documents
    .map((doc) => `### ${doc.name} (${doc.type})\n${doc.content}`)
    .join('\n\n');

  const languageInstruction =
    language === 'da'
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

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
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
      max_tokens: 4096,
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
