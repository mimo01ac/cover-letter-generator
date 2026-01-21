import { supabase } from '../lib/supabase';
import type { Profile, Document, InterviewGuide } from '../types';

interface VapiCallResponse {
  id: string;
  status: string;
  transcript?: string;
  summary?: string;
  endedReason?: string;
}

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return session.access_token;
}

export async function generateInterviewGuide(
  profile: Profile,
  documents: Document[]
): Promise<InterviewGuide> {
  const token = await getAuthToken();

  const response = await fetch('/api/interview/generate-guide', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ profile, documents }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Failed to generate interview guide');
  }

  return response.json();
}

export function buildVapiPrompt(profile: Profile, guide: InterviewGuide): string {
  const questionsText = guide.questions
    .map((q, i) => `${i + 1}. [${q.topic}] ${q.question}\n   Follow-ups: ${q.followUps.join('; ')}`)
    .join('\n\n');

  return `You are a professional career interviewer conducting a deep-dive interview with ${profile.name}. Your goal is to gather detailed information about their professional experience that will help create highly personalized cover letters.

## Your Approach
- Be warm, professional, and conversational
- Listen actively and ask follow-up questions based on their answers
- Dig deeper when they mention achievements - ask for specific numbers, outcomes, challenges
- Keep the conversation flowing naturally
- Take mental notes of unique stories and specific examples

## Interview Structure

### Introduction
${guide.introduction}

### Questions to Cover
${questionsText}

### Closing
${guide.closing}

## Important Guidelines
- Speak naturally, not like reading a script
- If they give a brief answer, probe deeper: "That's interesting, can you tell me more about..."
- When they mention achievements, ask: "What was the specific impact?" or "How did you measure success?"
- Keep track of time - aim for 15-20 minutes total
- End warmly and thank them for their time

Remember: The goal is to uncover stories and details that aren't in their CV - the nuances that make them unique.`;
}

export async function startVapiCall(
  phoneNumber: string,
  assistantPrompt: string,
  profileName: string
): Promise<string> {
  const token = await getAuthToken();

  const response = await fetch('/api/interview/start-call', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ phoneNumber, assistantPrompt, profileName }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMessage = errorData?.error || `HTTP ${response.status}`;
    throw new Error(`Failed to start call: ${errorMessage}`);
  }

  const data = await response.json();
  return data.callId;
}

export async function getCallStatus(callId: string): Promise<VapiCallResponse> {
  const token = await getAuthToken();

  const response = await fetch(`/api/interview/call-status?callId=${callId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get call status');
  }

  return response.json();
}

export async function processTranscript(
  transcript: string,
  profileName: string
): Promise<{ summary: string; insights: string }> {
  const token = await getAuthToken();

  const response = await fetch('/api/interview/process-transcript', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ transcript, profileName }),
  });

  if (!response.ok) {
    throw new Error('Failed to process transcript');
  }

  return response.json();
}
