import { supabase } from '../lib/supabase';
import type { GenerationRequest, RefinementRequest } from '../types';

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return session.access_token;
}

export async function generateCoverLetter(
  request: GenerationRequest,
  onStream?: (text: string) => void
): Promise<string> {
  const token = await getAuthToken();

  const response = await fetch('/api/cover-letter/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  if (onStream && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullCoverLetter = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'cover_letter' && parsed.text) {
              fullCoverLetter += parsed.text;
              onStream(fullCoverLetter);
            } else if (parsed.text && !parsed.type) {
              // Backwards compatibility: untyped text goes to cover letter
              fullCoverLetter += parsed.text;
              onStream(fullCoverLetter);
            }

            if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch (e) {
            // Skip invalid JSON (happens with partial chunks)
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    }

    return fullCoverLetter;
  }

  // Non-streaming fallback
  const data = await response.json();
  return data.content || '';
}

export async function refineCoverLetter(
  request: RefinementRequest,
  onStream?: (text: string) => void
): Promise<string> {
  const token = await getAuthToken();

  const response = await fetch('/api/cover-letter/refine', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  if (onStream && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              fullText += parsed.text;
              onStream(fullText);
            }
            if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    }

    return fullText;
  }

  const data = await response.json();
  return data.content || '';
}
