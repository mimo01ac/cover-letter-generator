import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface StartCallRequest {
  phoneNumber: string;
  assistantPrompt: string;
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

  const body = req.body as StartCallRequest;
  const { phoneNumber, assistantPrompt, profileName } = body;

  if (!process.env.VAPI_API_KEY) {
    console.error('VAPI_API_KEY not configured');
    return res.status(500).json({ error: 'Server configuration error: VAPI_API_KEY not set' });
  }

  if (!process.env.VAPI_PHONE_NUMBER_ID) {
    console.error('VAPI_PHONE_NUMBER_ID not configured');
    return res.status(500).json({ error: 'Server configuration error: VAPI_PHONE_NUMBER_ID not set' });
  }

  try {
    const response = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      },
      body: JSON.stringify({
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        customer: {
          number: phoneNumber,
          name: profileName,
        },
        assistant: {
          name: 'Career Interview Assistant',
          model: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            messages: [{
              role: 'system',
              content: assistantPrompt,
            }],
          },
          voice: {
            provider: '11labs',
            voiceId: 'paula',
          },
          firstMessage: `Hi ${profileName}, this is your career interview assistant. Thank you for taking the time to speak with me today. I'd like to learn more about your professional experience to help create better, more personalized cover letters for you. Is now still a good time to chat for about 15-20 minutes?`,
          endCallMessage: "Thank you so much for sharing your experiences with me today. This has been really valuable, and I'll make sure all these insights are saved to help with your future cover letters. Have a great day!",
          endCallPhrases: ['goodbye', 'bye', 'end call', 'stop'],
          transcriber: {
            provider: 'deepgram',
            model: 'nova-2',
            language: 'en',
          },
          recordingEnabled: true,
          maxDurationSeconds: 1800,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error: `Failed to start call: ${error}` });
    }

    const data = await response.json();
    return res.status(200).json({ callId: data.id });
  } catch (error) {
    console.error('Vapi API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Failed to start call: ${errorMessage}` });
  }
}
