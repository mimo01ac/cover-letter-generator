import { supabase } from '../lib/supabase';
import type {
  CVTailorGenerationRequest,
  TailoredCVData,
  Profile,
  Document,
  ChatMessage
} from '../types';

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return session.access_token;
}

export interface CVGenerationCallbacks {
  onStatus?: (phase: string, message: string) => void;
  onCVId?: (id: string) => void;
  onCVData?: (data: TailoredCVData) => void;
  onError?: (error: string) => void;
}

export interface CVGenerationResult {
  cvId: string;
  cvData: TailoredCVData;
}

export async function generateTailoredCV(
  request: CVTailorGenerationRequest,
  profile: Profile,
  documents: Document[],
  callbacks: CVGenerationCallbacks
): Promise<CVGenerationResult> {
  const token = await getAuthToken();

  const response = await fetch('/api/cv-tailor/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...request,
      profile: {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        location: profile.location,
        summary: profile.summary,
      },
      documents: documents.map(d => ({
        name: d.name,
        type: d.type,
        content: d.content,
      })),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let cvId = '';
  let cvData: TailoredCVData | null = null;

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

          switch (parsed.type) {
            case 'status':
              callbacks.onStatus?.(parsed.phase, parsed.message);
              break;

            case 'cv_id':
              cvId = parsed.id;
              callbacks.onCVId?.(parsed.id);
              break;

            case 'cv_data':
              cvData = parsed.data;
              callbacks.onCVData?.(parsed.data);
              break;

            case 'error':
              callbacks.onError?.(parsed.message);
              throw new Error(parsed.message);
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
  }

  if (!cvData) {
    throw new Error('No CV data received');
  }

  return { cvId, cvData };
}

export async function refineTailoredCV(
  cvId: string,
  currentCVData: TailoredCVData,
  userRequest: string,
  conversationHistory: ChatMessage[],
  profile: Profile,
  documents: Document[],
  jobDescription: string,
  language: string,
  onStream?: (data: TailoredCVData) => void
): Promise<TailoredCVData> {
  const token = await getAuthToken();

  const response = await fetch('/api/cv-tailor/refine', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      cvId,
      currentCVData,
      userRequest,
      conversationHistory: conversationHistory.map(m => ({
        role: m.role,
        content: m.content,
      })),
      profile: {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        location: profile.location,
        summary: profile.summary,
      },
      documents: documents.map(d => ({
        name: d.name,
        type: d.type,
        content: d.content,
      })),
      jobDescription,
      language,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  if (result.cvData) {
    onStream?.(result.cvData);
    return result.cvData;
  }

  throw new Error('No CV data in refinement response');
}
