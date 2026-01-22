import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface GenerationRequest {
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
  companyName: string;
  jobDescription: string;
  language?: 'en' | 'da';
  customNotes?: string;
}

function buildSystemPrompt(
  profile: GenerationRequest['profile'],
  documents: GenerationRequest['documents'],
  language: 'en' | 'da'
): string {
  const cvContent = documents
    .map((doc) => `### ${doc.name} (${doc.type})\n${doc.content}`)
    .join('\n\n');

  const languageInstruction =
    language === 'da'
      ? 'Write the cover letter in Danish (Dansk).'
      : 'Write the cover letter in English.';

  return `You are an expert cover letter writer. Your task is to create compelling, personalized cover letters that highlight the candidate's relevant experience and skills.

## Candidate Profile
Name: ${profile.name}
Email: ${profile.email}
Phone: ${profile.phone}
Location: ${profile.location}
Summary: ${profile.summary || 'Not provided'}

## Candidate Documents
${cvContent || 'No documents provided'}

## Instructions
- ${languageInstruction}
- Create a professional, engaging cover letter
- Highlight relevant experience from the CV/documents
- Match the candidate's skills to the job requirements
- Keep the tone professional but personable
- Structure: Opening hook, relevant experience, why this company, closing
- Length: 300-400 words
- Do NOT include placeholders - use the actual information provided
- Output ONLY the cover letter text, no explanations or metadata`;
}

function buildUserMessage(
  jobTitle: string,
  companyName: string,
  jobDescription: string,
  customNotes?: string
): string {
  let message = `Write a cover letter for this position:

## Job Title
${jobTitle}

## Company
${companyName || 'Not specified'}

## Job Description
${jobDescription}`;

  if (customNotes) {
    message += `\n\n## Additional Instructions\n${customNotes}`;
  }

  return message;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check required environment variables
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Missing ANTHROPIC_API_KEY environment variable');
    return res.status(500).json({ error: 'Server configuration error: Missing API key' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('Missing Supabase environment variables');
    return res.status(500).json({ error: 'Server configuration error: Missing database config' });
  }

  // Verify auth token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
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

    const body = req.body as GenerationRequest;
    const { profile, documents, jobTitle, companyName, jobDescription, language = 'da', customNotes } = body;

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const system = buildSystemPrompt(profile, documents, language);
    const userMessage = buildUserMessage(jobTitle, companyName, jobDescription, customNotes);

    // Set up streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: userMessage }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('API error:', error);
    const message = error instanceof Error ? error.message : 'Generation failed';

    // If headers haven't been sent yet, return JSON error
    if (!res.headersSent) {
      return res.status(500).json({ error: message });
    }

    // Otherwise send error through stream
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
}
