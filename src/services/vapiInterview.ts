import { supabase } from '../lib/supabase';
import type {
  Profile,
  Document,
  InterviewGuide,
  InterviewMode,
  InterviewBriefing,
  MockInterviewFeedback,
} from '../types';

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

export function buildMockInterviewPrompt(
  profileName: string,
  companyName: string,
  jobTitle: string,
  briefing: InterviewBriefing,
  cvContent?: string
): string {
  const research = briefing.companyResearch;
  const questions = briefing.interviewQuestions || [];

  const companyContext = research ? `
## Company Context (use this to answer candidate questions authentically)
- Mission: ${research.mission || 'N/A'}
- Values: ${research.values?.join(', ') || 'N/A'}
- Culture: ${research.culture || 'N/A'}
- Recent news: ${research.recentNews?.join('; ') || 'N/A'}
- Key people: ${research.keyPeople?.map(p => `${p.name} (${p.title})`).join(', ') || 'N/A'}
- Employee count: ${research.employeeCount || 'N/A'}
- Founded: ${research.founded || 'N/A'}
- HQ: ${research.headquarters || 'N/A'}` : '';

  const questionsText = questions
    .map((q, i) => `${i + 1}. [${q.category}] ${q.question}`)
    .join('\n');

  const cvSection = cvContent ? `
## Candidate CV (for your reference — do NOT reveal you have this)
${cvContent}` : '';

  return `You are Alex, a senior recruiter at ${companyName}, conducting a phone screen for the ${jobTitle} position. You are professional, warm, and genuinely interested in finding the right candidate.

## Your Personality
- Friendly but professional — this is a real interview, not a casual chat
- You ask probing follow-up questions when answers are vague
- You politely push back and ask for specifics: "Can you give me a concrete example?" or "What were the actual numbers?"
- You represent ${companyName} authentically using the company context below
${companyContext}
${cvSection}

## Interview Flow
1. **Opening** (1-2 min): Brief intro, explain the role and interview format
2. **Core Questions** (10-15 min): Work through the prepared questions, with follow-ups
3. **Cultural Fit** (3-5 min): Assess alignment with company values
4. **Candidate Questions** (2-3 min): Let them ask about the role/company
5. **Closing** (1 min): Thank them, explain next steps

## Questions to Cover
${questionsText}

## Important Guidelines
- Stay in character as Alex the recruiter at ALL times
- Do NOT break character or provide coaching/feedback during the call
- If the candidate gives a surface-level answer, dig deeper: "That's interesting — what specifically was your role in that?"
- If they claim achievements, ask for metrics: "What was the measurable impact?"
- Be natural and conversational — don't read questions robotically
- Keep track of time — aim for about 20 minutes total
- If the candidate asks about the company, use the company context to answer authentically
- End professionally: thank them and mention that next steps will follow`;
}

export async function startVapiCall(
  phoneNumber: string,
  assistantPrompt: string,
  profileName: string,
  options?: { mode?: InterviewMode; companyName?: string; jobTitle?: string }
): Promise<string> {
  const token = await getAuthToken();

  const response = await fetch('/api/interview/start-call', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      phoneNumber,
      assistantPrompt,
      profileName,
      mode: options?.mode,
      companyName: options?.companyName,
      jobTitle: options?.jobTitle,
    }),
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
  profileName: string,
  options?: { mode?: InterviewMode; jobTitle?: string; companyName?: string; jobDescription?: string }
): Promise<{ summary?: string; insights?: string; feedback?: MockInterviewFeedback }> {
  const token = await getAuthToken();

  const response = await fetch('/api/interview/process-transcript', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      transcript,
      profileName,
      mode: options?.mode,
      jobTitle: options?.jobTitle,
      companyName: options?.companyName,
      jobDescription: options?.jobDescription,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to process transcript');
  }

  return response.json();
}
