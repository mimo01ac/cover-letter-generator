import { supabase } from '../lib/supabase';
import type {
  InterviewPrepGenerationRequest,
  InterviewQuestion,
  TalkingPoint,
  ChatMessage,
  Profile,
  Document
} from '../types';

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return session.access_token;
}

export interface GenerationCallbacks {
  onStatus?: (phase: string, message: string) => void;
  onBriefingId?: (id: string) => void;
  onBriefing?: (text: string) => void;
  onQuestions?: (questions: InterviewQuestion[]) => void;
  onTalkingPoints?: (points: TalkingPoint[]) => void;
  onPodcast?: (text: string) => void;
  onError?: (error: string) => void;
}

export interface GenerationResult {
  briefingId: string;
  briefingDocument: string;
  interviewQuestions: InterviewQuestion[];
  talkingPoints: TalkingPoint[];
  podcastScript: string;
}

export async function generateInterviewBriefing(
  request: InterviewPrepGenerationRequest,
  profile: Profile,
  documents: Document[],
  callbacks: GenerationCallbacks
): Promise<GenerationResult> {
  const token = await getAuthToken();

  const response = await fetch('/api/interview-prep/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...request,
      profile: {
        name: profile.name,
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

  let briefingId = '';
  let briefingDocument = '';
  let interviewQuestions: InterviewQuestion[] = [];
  let talkingPoints: TalkingPoint[] = [];
  let podcastScript = '';

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

            case 'briefing_id':
              briefingId = parsed.id;
              callbacks.onBriefingId?.(parsed.id);
              break;

            case 'briefing':
              briefingDocument += parsed.text;
              callbacks.onBriefing?.(briefingDocument);
              break;

            case 'briefing_done':
              // Briefing streaming complete
              break;

            case 'questions':
              interviewQuestions = parsed.data || [];
              callbacks.onQuestions?.(interviewQuestions);
              break;

            case 'talking_points':
              talkingPoints = parsed.data || [];
              callbacks.onTalkingPoints?.(talkingPoints);
              break;

            case 'podcast':
              podcastScript += parsed.text;
              callbacks.onPodcast?.(podcastScript);
              break;

            case 'podcast_done':
              // Podcast streaming complete
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

  return {
    briefingId,
    briefingDocument,
    interviewQuestions,
    talkingPoints,
    podcastScript,
  };
}

export async function refineSection(
  briefingId: string,
  section: 'briefing' | 'questions' | 'talking_points' | 'podcast',
  userRequest: string,
  conversationHistory: ChatMessage[],
  onStream?: (text: string) => void
): Promise<string> {
  const token = await getAuthToken();

  const response = await fetch('/api/interview-prep/refine', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      briefingId,
      section,
      userRequest,
      conversationHistory: conversationHistory.map(m => ({
        role: m.role,
        content: m.content,
      })),
    }),
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
            if (parsed.type === 'text' && parsed.text) {
              fullText += parsed.text;
              onStream(fullText);
            }
            if (parsed.type === 'error') {
              throw new Error(parsed.message);
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

export async function generateAudio(
  briefingId: string,
  text: string
): Promise<{ audioUrl: string; duration: number }> {
  const token = await getAuthToken();

  const response = await fetch('/api/interview-prep/generate-audio', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ briefingId, text }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Audio generation failed');
  }

  return await response.json();
}

export async function researchCompany(
  companyName: string,
  industry?: string,
  companyUrl?: string
): Promise<{
  companyResearch: unknown;
  industryAnalysis: unknown;
  competitiveLandscape: unknown;
}> {
  const token = await getAuthToken();

  const response = await fetch('/api/interview-prep/research', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ companyName, industry, companyUrl }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return await response.json();
}
