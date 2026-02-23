import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { jobDescription } = req.body as { jobDescription?: string };
  if (!jobDescription || jobDescription.trim().length < 50) {
    return res.status(400).json({ error: 'Job description too short' });
  }

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: 'Extract the job title and company name from the job posting below. Return ONLY valid JSON: {"jobTitle": "...", "companyName": "..."}. If either cannot be determined, use an empty string.',
      messages: [{ role: 'user', content: jobDescription.slice(0, 3000) }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.json({ jobTitle: '', companyName: '' });
    }

    const parsed = JSON.parse(match[0]);
    return res.json({
      jobTitle: typeof parsed.jobTitle === 'string' ? parsed.jobTitle : '',
      companyName: typeof parsed.companyName === 'string' ? parsed.companyName : '',
    });
  } catch {
    return res.json({ jobTitle: '', companyName: '' });
  }
}
