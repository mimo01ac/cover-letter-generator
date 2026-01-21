import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface AnalyzeRequest {
  coverLetter: string;
  jobDescription: string;
  jobTitle: string;
  language?: 'en' | 'da';
}

interface FeedbackSuggestion {
  title: string;
  description: string;
}

interface CoverLetterFeedback {
  matchScore: number;
  suggestions: FeedbackSuggestion[];
  missingKeywords: string[];
  strengths: string[];
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

  const body = req.body as AnalyzeRequest;
  const { coverLetter, jobDescription, jobTitle, language = 'da' } = body;

  const languageInstruction =
    language === 'da'
      ? 'Provide the analysis in Danish (Dansk).'
      : 'Provide the analysis in English.';

  const system = `You are an expert cover letter analyst. Analyze cover letters and provide actionable feedback.

${languageInstruction}

Respond with ONLY valid JSON in this exact format:
{
  "matchScore": <number 0-100>,
  "suggestions": [
    {"title": "<short title>", "description": "<detailed suggestion>"}
  ],
  "missingKeywords": ["<keyword1>", "<keyword2>"],
  "strengths": ["<strength1>", "<strength2>"]
}

Guidelines:
- matchScore: How well the cover letter matches the job (0-100)
- suggestions: 3-5 actionable improvements
- missingKeywords: Important terms from the job description not in the letter
- strengths: 2-4 things the letter does well`;

  const userMessage = `Analyze this cover letter for the position of ${jobTitle}:

## Cover Letter
${coverLetter}

## Job Description
${jobDescription}`;

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: userMessage }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse feedback' });
    }

    const feedback: CoverLetterFeedback = JSON.parse(jsonMatch[0]);
    return res.status(200).json(feedback);
  } catch (error) {
    console.error('Claude API error:', error);
    return res.status(500).json({ error: 'Analysis failed' });
  }
}
