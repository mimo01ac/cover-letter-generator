import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface GenerateGuideRequest {
  profile: {
    name: string;
    email: string;
    summary: string;
  };
  documents: Array<{
    name: string;
    type: string;
    content: string;
  }>;
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

  const body = req.body as GenerateGuideRequest;
  const { profile, documents } = body;

  const cvContent = documents
    .map((doc) => `### ${doc.name} (${doc.type})\n${doc.content}`)
    .join('\n\n');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not configured');
    return res.status(500).json({ error: 'Server configuration error: ANTHROPIC_API_KEY not set' });
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Analyze this CV/profile and create a comprehensive interview guide to gather deeper insights about the person's experience. The goal is to extract detailed stories, specific achievements, and nuances that will help create better, more personalized cover letters.

## Profile
Name: ${profile.name}
Email: ${profile.email}
Summary: ${profile.summary || 'Not provided'}

## Documents
${cvContent || 'No documents uploaded'}

Create an interview guide in JSON format with:
1. A warm introduction explaining the purpose
2. 8-12 questions covering:
   - Career journey and transitions
   - Specific achievements with metrics/results
   - Challenges overcome and lessons learned
   - Leadership and collaboration examples
   - Technical skills in practice
   - Work style and preferences
   - Motivations and career goals
3. Each question should have 2-3 follow-up prompts
4. A closing section

Respond ONLY with valid JSON in this format:
{
  "introduction": "string",
  "questions": [
    {
      "topic": "string",
      "question": "string",
      "followUps": ["string", "string"]
    }
  ],
  "closing": "string"
}`
      }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse interview guide' });
    }

    const guide = JSON.parse(jsonMatch[0]);
    return res.status(200).json(guide);
  } catch (error) {
    console.error('Claude API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Failed to generate interview guide: ${errorMessage}` });
  }
}
