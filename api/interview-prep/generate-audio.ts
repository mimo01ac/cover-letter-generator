import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface AudioRequest {
  briefingId: string;
  text: string;
}

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
}

// Default voice settings - using a professional, conversational voice
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // "Sarah" - warm, professional female voice
const FALLBACK_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // "Adam" - professional male voice

async function getAvailableVoice(apiKey: string): Promise<string> {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch voices:', response.status);
      return DEFAULT_VOICE_ID;
    }

    const data = await response.json() as { voices: ElevenLabsVoice[] };

    // Try to find Sarah or Adam, or use the first available voice
    const preferredVoices = ['Sarah', 'Adam', 'Rachel', 'Josh'];
    for (const name of preferredVoices) {
      const voice = data.voices?.find(v => v.name === name);
      if (voice) {
        return voice.voice_id;
      }
    }

    // Return first available voice or default
    return data.voices?.[0]?.voice_id || DEFAULT_VOICE_ID;
  } catch (error) {
    console.error('Error fetching voices:', error);
    return DEFAULT_VOICE_ID;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server configuration error: Missing database config' });
  }

  if (!elevenLabsKey) {
    return res.status(400).json({
      error: 'Audio generation not configured',
      message: 'ElevenLabs API key is not set. Audio generation is unavailable.',
    });
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

    const { briefingId, text } = req.body as AudioRequest;

    if (!briefingId || !text) {
      return res.status(400).json({ error: 'Missing briefingId or text' });
    }

    // Verify the briefing belongs to the user
    const { data: briefing, error: briefingError } = await supabase
      .from('interview_briefings')
      .select('id, profile_id')
      .eq('id', briefingId)
      .single();

    if (briefingError || !briefing) {
      return res.status(404).json({ error: 'Briefing not found' });
    }

    // Check if profile belongs to user
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', briefing.profile_id)
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get a suitable voice
    const voiceId = await getAvailableVoice(elevenLabsKey);

    // Call ElevenLabs TTS API
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsKey,
        },
        body: JSON.stringify({
          text: text.substring(0, 5000), // ElevenLabs has a character limit per request
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error('ElevenLabs API error:', ttsResponse.status, errorText);
      return res.status(500).json({
        error: 'Audio generation failed',
        details: errorText,
      });
    }

    // Get the audio data
    const audioBuffer = await ttsResponse.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`;

    // Save the audio URL to the briefing
    await supabase
      .from('interview_briefings')
      .update({ audio_url: audioDataUrl })
      .eq('id', briefingId);

    // Return the audio data
    return res.status(200).json({
      audioUrl: audioDataUrl,
      duration: Math.ceil(text.length / 15), // Rough estimate: ~15 chars per second
    });
  } catch (error) {
    console.error('Generate audio API error:', error);
    const message = error instanceof Error ? error.message : 'Audio generation failed';
    return res.status(500).json({ error: message });
  }
}
