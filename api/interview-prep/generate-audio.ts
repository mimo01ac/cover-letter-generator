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

// Clean podcast script for TTS - remove structural elements that shouldn't be spoken
function cleanScriptForTTS(script: string): string {
  return script
    // Remove markdown headers (## Section, ### Subsection)
    .replace(/^#{1,6}\s+.+$/gm, '')
    // Remove bold/italic markers but keep the text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove time markers like (5 min), [3 minutes], (1-2 min), etc.
    .replace(/\(?\[?\d+[-–]?\d*\s*(?:min(?:ute)?s?|sec(?:ond)?s?)\]?\)?/gi, '')
    // Remove section labels with timing like "Opening (1 min)"
    .replace(/^.{0,30}\(\d+\s*min(?:ute)?s?\)\s*[-–:]?\s*/gm, '')
    // Remove stage directions in parentheses like (pause), (emphasis), (slowly)
    .replace(/\((?:pause|beat|slowly|emphasis|softer|louder|whisper|excited)\)/gi, '')
    // Remove ellipsis used as pause indicators (but keep sentence-ending ones)
    .replace(/\s*\.\.\.\s*/g, '. ')
    // Remove bullet points and list markers
    .replace(/^[\s]*[-•*]\s*/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Remove section dividers
    .replace(/^[-=]{3,}$/gm, '')
    // Remove "Section X:" or "Part X:" labels
    .replace(/^(?:Section|Part|Chapter)\s*\d*\s*[:–-]\s*/gim, '')
    // Clean up multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    // Clean up multiple spaces
    .replace(/\s{2,}/g, ' ')
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n\n')
    .trim();
}

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

    // Clean the script for TTS (remove structural elements)
    const cleanedText = cleanScriptForTTS(text);
    console.log(`Original text length: ${text.length}, Cleaned text length: ${cleanedText.length}`);

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
          text: cleanedText.substring(0, 5000), // ElevenLabs has a character limit per request
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

      // Parse the error for a more specific message
      let errorMessage = 'Audio generation failed';
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.detail?.message) {
          errorMessage = errorJson.detail.message;
        } else if (errorJson.detail) {
          errorMessage = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
        } else if (errorJson.message) {
          errorMessage = errorJson.message;
        } else if (errorJson.error) {
          errorMessage = errorJson.error;
        }
      } catch {
        // If not JSON, use the raw text if it's not too long
        if (errorText.length < 200) {
          errorMessage = errorText;
        }
      }

      // Add status code context for common errors
      if (ttsResponse.status === 401) {
        errorMessage = 'Invalid ElevenLabs API key';
      } else if (ttsResponse.status === 429) {
        errorMessage = 'ElevenLabs rate limit exceeded. Please try again later.';
      } else if (ttsResponse.status === 422) {
        errorMessage = `Invalid request: ${errorMessage}`;
      }

      return res.status(500).json({
        error: errorMessage,
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
      duration: Math.ceil(cleanedText.length / 15), // Rough estimate: ~15 chars per second
    });
  } catch (error) {
    console.error('Generate audio API error:', error);
    const message = error instanceof Error ? error.message : 'Audio generation failed';
    return res.status(500).json({ error: message });
  }
}
