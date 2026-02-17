import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RefinementRequest {
  cvId: string;
  currentCVData: Record<string, unknown>;
  userRequest: string;
  conversationHistory: ChatMessage[];
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
  language?: string;
}

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

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body as RefinementRequest;
  const {
    cvId,
    currentCVData,
    userRequest,
    conversationHistory,
    profile,
    documents,
    jobDescription,
    language = 'en',
  } = body;

  const languageInstruction = language === 'da'
    ? 'Respond in Danish (Dansk).'
    : 'Respond in English.';

  const cvContent = documents
    .map((doc) => `### ${doc.name} (${doc.type})\n${doc.content}`)
    .join('\n\n');

  const system = `You are an expert CV editor helping to refine and improve a tailored CV. ${languageInstruction}

## Context
You are helping ${profile.name} refine their tailored CV.

## Candidate Documents
${cvContent || 'No documents provided'}

## Job Description
${jobDescription}

## Current CV Data (JSON)
${JSON.stringify(currentCVData, null, 2)}

## Instructions
- Make the requested changes to the CV data
- Return the COMPLETE updated CV data as a JSON object
- Maintain the same JSON structure (headline, executiveSummary, careerHighlights, coreCompetencies, experience, education, certifications, languages)
- NEVER invent new experiences or companies
- You may rewrite bullet points, reorder entries, adjust the summary, add/remove skills
- Return ONLY valid JSON, no markdown or explanation`;

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userRequest },
  ];

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      temperature: 0,
      system,
      messages,
    });

    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in refinement response');
    }

    let jsonText = textContent.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const cvData = JSON.parse(jsonText);

    // Update in database
    await (supabase.from('tailored_cvs') as ReturnType<typeof supabase.from>)
      .update({ cv_data: cvData } as Record<string, unknown>)
      .eq('id', cvId);

    return res.status(200).json({ cvData });
  } catch (error) {
    console.error('CV refinement error:', error);
    const message = error instanceof Error ? error.message : 'Refinement failed';
    return res.status(500).json({ error: message });
  }
}
