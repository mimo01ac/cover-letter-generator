import { supabase } from '../lib/supabase';
import type { CaseAnalysis, CaseInterviewFeedback } from '../types';

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return session.access_token;
}

export interface CaseAnalysisCallbacks {
  onStatus?: (phase: string, message: string) => void;
  onCaseId?: (id: string) => void;
  onSummary?: (text: string) => void;
  onSummaryDone?: () => void;
  onError?: (message: string) => void;
  onComplete?: () => void;
}

export async function generateCaseAnalysis(
  profileId: string,
  title: string,
  caseContent: string,
  briefingId: string | null,
  callbacks: CaseAnalysisCallbacks
): Promise<void> {
  const token = await getAuthToken();

  const response = await fetch('/api/interview-prep/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      type: 'case-analysis',
      profileId,
      title,
      caseContent,
      briefingId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Failed to analyze case');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response stream');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') {
        callbacks.onComplete?.();
        return;
      }

      try {
        const event = JSON.parse(payload);
        switch (event.type) {
          case 'status':
            callbacks.onStatus?.(event.phase, event.message);
            break;
          case 'case_id':
            callbacks.onCaseId?.(event.id);
            break;
          case 'summary':
            callbacks.onSummary?.(event.text);
            break;
          case 'summary_done':
            callbacks.onSummaryDone?.();
            break;
          case 'error':
            callbacks.onError?.(event.message);
            break;
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }
}

export async function getCaseAnalysis(id: string): Promise<CaseAnalysis | undefined> {
  const { data, error } = await (supabase
    .from('case_analyses' as 'profiles') as unknown as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return undefined;

  const row = data as Record<string, unknown>;
  return rowToCaseAnalysis(row);
}

export async function getCaseAnalysesByProfile(profileId: string): Promise<CaseAnalysis[]> {
  const { data, error } = await (supabase
    .from('case_analyses' as 'profiles') as unknown as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data || []) as Record<string, unknown>[]).map(rowToCaseAnalysis);
}

export async function updateCaseAnalysis(
  id: string,
  updates: Partial<{ solutionsRevealed: boolean; status: string }>
): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (updates.solutionsRevealed !== undefined) updateData.solutions_revealed = updates.solutionsRevealed;
  if (updates.status !== undefined) updateData.status = updates.status;

  const { error } = await (supabase
    .from('case_analyses' as 'profiles') as unknown as ReturnType<typeof supabase.from>)
    .update(updateData)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteCaseAnalysis(id: string): Promise<void> {
  const { error } = await (supabase
    .from('case_analyses' as 'profiles') as unknown as ReturnType<typeof supabase.from>)
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getCaseInterviewsByAnalysis(caseAnalysisId: string): Promise<Array<{
  id: string;
  feedback: CaseInterviewFeedback | null;
  createdAt: Date;
}>> {
  const { data, error } = await (supabase
    .from('interview_results' as 'profiles') as unknown as ReturnType<typeof supabase.from>)
    .select('id, feedback, created_at')
    .eq('briefing_id', caseAnalysisId)
    .eq('mode', 'case-interview')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data || []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    feedback: (row.feedback as CaseInterviewFeedback) || null,
    createdAt: new Date(row.created_at as string),
  }));
}

function rowToCaseAnalysis(row: Record<string, unknown>): CaseAnalysis {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    briefingId: (row.briefing_id as string) || null,
    title: row.title as string,
    caseContent: row.case_content as string,
    summary: (row.summary as string) || '',
    framework: (row.framework as CaseAnalysis['framework']) || null,
    approaches: (row.approaches as CaseAnalysis['approaches']) || [],
    keyMetrics: (row.key_metrics as string[]) || [],
    pitfalls: (row.pitfalls as string[]) || [],
    solutionsRevealed: (row.solutions_revealed as boolean) || false,
    status: row.status as CaseAnalysis['status'],
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}
