import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface RefineRequest {
  briefingId: string;
  section: 'briefing' | 'questions' | 'talking_points' | 'podcast';
  userRequest: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

const SECTION_PROMPTS: Record<string, string> = {
  briefing: `You are an expert career coach helping refine an interview briefing document.
The candidate wants to modify or improve their briefing. Make the requested changes while maintaining the document's professional quality and structure.
Only output the refined section or the full document if they ask for comprehensive changes.`,

  questions: `You are an expert interview coach helping refine interview questions and suggested answers.
The candidate wants to modify their interview Q&A. Make the requested changes while ensuring answers remain authentic and based on their actual experience.
When adding or modifying questions, output them in JSON format with the structure: {"category": "...", "question": "...", "suggestedAnswer": "...", "tips": "..."}
For multiple questions, wrap them in an array.`,

  talking_points: `You are an expert interview coach helping refine STAR-format talking points.
The candidate wants to modify their talking points. Make the requested changes while keeping the STAR structure clear and the stories compelling.
When modifying talking points, output them in JSON format with the structure: {"situation": "...", "task": "...", "action": "...", "result": "...", "relevantFor": [...]}
For multiple talking points, wrap them in an array.`,

  podcast: `You are a professional podcast scriptwriter helping refine an interview preparation podcast script.
The candidate wants to modify their audio briefing script. Make the requested changes while maintaining a conversational, engaging tone suitable for audio.
Use "..." for pauses and *asterisks* for emphasis.`,
};

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

    const { briefingId, section, userRequest, conversationHistory } = req.body as RefineRequest;

    if (!briefingId || !section || !userRequest) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Fetch the briefing
    const { data: briefing, error: briefingError } = await supabase
      .from('interview_briefings')
      .select('*')
      .eq('id', briefingId)
      .single();

    if (briefingError || !briefing) {
      return res.status(404).json({ error: 'Briefing not found' });
    }

    // Verify access through profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', briefing.profile_id)
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get the current content for the section
    let currentContent = '';
    switch (section) {
      case 'briefing':
        currentContent = briefing.briefing_document || '';
        break;
      case 'questions':
        currentContent = JSON.stringify(briefing.interview_questions || [], null, 2);
        break;
      case 'talking_points':
        currentContent = JSON.stringify(briefing.talking_points || [], null, 2);
        break;
      case 'podcast':
        currentContent = briefing.podcast_script || '';
        break;
    }

    // Build messages for Claude
    const messages: Anthropic.MessageParam[] = [];

    // Add context about the current content
    messages.push({
      role: 'user',
      content: `Here is the current ${section} content:\n\n${currentContent}\n\nThe job is: ${briefing.job_title} at ${briefing.company_name}`,
    });

    messages.push({
      role: 'assistant',
      content: 'I understand. I\'ll help you refine this content. What would you like to change?',
    });

    // Add conversation history
    for (const msg of conversationHistory || []) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add the new request
    messages.push({
      role: 'user',
      content: userRequest,
    });

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    // Set up streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.3,
      system: SECTION_PROMPTS[section],
      messages,
    });

    let fullResponse = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullResponse += event.delta.text;
        res.write(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`);
      }
    }

    // Try to parse and update the database if the response contains structured data
    if (section === 'questions' || section === 'talking_points') {
      try {
        // Try to extract JSON from the response
        let jsonText = fullResponse.trim();
        const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1];
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
        }

        // Only update if we can parse valid JSON
        const parsed = JSON.parse(jsonText);
        const updateField = section === 'questions' ? 'interview_questions' : 'talking_points';

        // If it's an array, replace the content; if it's a single item, we keep the response as guidance
        if (Array.isArray(parsed)) {
          await supabase
            .from('interview_briefings')
            .update({ [updateField]: parsed })
            .eq('id', briefingId);

          res.write(`data: ${JSON.stringify({ type: 'update', field: updateField })}\n\n`);
        }
      } catch {
        // Not valid JSON, that's okay - it's probably just conversational guidance
      }
    } else if (section === 'briefing' && fullResponse.includes('##')) {
      // If the response looks like a full document update
      await supabase
        .from('interview_briefings')
        .update({ briefing_document: fullResponse })
        .eq('id', briefingId);

      res.write(`data: ${JSON.stringify({ type: 'update', field: 'briefing_document' })}\n\n`);
    } else if (section === 'podcast' && fullResponse.length > 500) {
      // If it's a substantial podcast update
      await supabase
        .from('interview_briefings')
        .update({ podcast_script: fullResponse })
        .eq('id', briefingId);

      res.write(`data: ${JSON.stringify({ type: 'update', field: 'podcast_script' })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Refine API error:', error);
    const message = error instanceof Error ? error.message : 'Refinement failed';

    if (!res.headersSent) {
      return res.status(500).json({ error: message });
    }

    res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
    res.end();
  }
}
