import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ProcessTranscriptRequest {
  transcript: string;
  profileName: string;
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

  const body = req.body as ProcessTranscriptRequest;
  const { transcript, profileName } = body;

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    // Generate insights from transcript
    const insightsResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Analyze this interview transcript and extract key insights that will help create better cover letters for ${profileName}.

## Transcript
${transcript}

Create a comprehensive summary with:

1. **Key Achievements** - Specific accomplishments with metrics/results mentioned
2. **Unique Stories** - Memorable examples and anecdotes that stand out
3. **Skills Demonstrated** - Technical and soft skills with real examples
4. **Work Style** - How they approach problems, collaborate, lead
5. **Motivations** - What drives them, career goals, ideal work environment
6. **Standout Qualities** - What makes them unique as a candidate

Format the output as a detailed document that can be used as reference when writing cover letters. Include direct quotes where impactful.`
      }],
    });

    const insights = insightsResponse.content[0].type === 'text' ? insightsResponse.content[0].text : '';

    // Generate brief summary
    const summaryResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Summarize this in 2-3 sentences - what are the most important things learned about this candidate?\n\n${insights}`
      }],
    });

    const summary = summaryResponse.content[0].type === 'text' ? summaryResponse.content[0].text : '';

    return res.status(200).json({ summary, insights });
  } catch (error) {
    console.error('Claude API error:', error);
    return res.status(500).json({ error: 'Failed to process transcript' });
  }
}
