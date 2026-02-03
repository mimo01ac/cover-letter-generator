import { supabase } from '../lib/supabase';

export interface ScrapedJobData {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  companyUrl?: string;
}

async function getAuthToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

export async function scrapeJobPosting(url: string): Promise<ScrapedJobData> {
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('/api/interview-prep/research', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'scrape', url }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to scrape URL (${response.status})`);
  }

  const data = await response.json();

  return {
    jobTitle: data.jobTitle || '',
    companyName: data.companyName || '',
    jobDescription: data.jobDescription || '',
    companyUrl: data.companyUrl || undefined,
  };
}
