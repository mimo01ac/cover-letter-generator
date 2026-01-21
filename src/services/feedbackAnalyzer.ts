import { supabase } from '../lib/supabase';
import type { CoverLetterFeedback } from '../types';

interface FeedbackRequest {
  coverLetter: string;
  jobDescription: string;
  jobTitle: string;
  language: 'en' | 'da';
}

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return session.access_token;
}

export async function analyzeCoverLetter(
  request: FeedbackRequest
): Promise<CoverLetterFeedback> {
  const token = await getAuthToken();

  const response = await fetch('/api/cover-letter/analyze', {
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

  return response.json();
}
