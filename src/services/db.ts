import { supabase } from '../lib/supabase';
import type { Json } from '../lib/database.types';
import type {
  Profile,
  Document,
  CoverLetter,
  InterviewResult,
  CachedInterviewGuide,
  InterviewBriefing,
  PreviousJob,
  CompanyResearch,
  IndustryAnalysis,
  CompetitiveLandscape,
  InterviewQuestion,
  TalkingPoint,
  TailoredCV,
  TailoredCVData
} from '../types';

// Helper to convert database rows to app types
function toDate(dateString: string | null): Date {
  return dateString ? new Date(dateString) : new Date();
}

// Profile operations
export async function createProfile(profile: Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      user_id: user.id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone || '',
      location: profile.location || '',
      summary: profile.summary || '',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Supabase createProfile error:', error);
    throw new Error(`Failed to create profile: ${error.message}`);
  }
  return data.id;
}

export async function getProfile(id: string): Promise<Profile | undefined> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return undefined;

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    location: data.location,
    summary: data.summary,
    createdAt: toDate(data.created_at),
    updatedAt: toDate(data.updated_at),
  };
}

export async function getAllProfiles(): Promise<Profile[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    location: row.location,
    summary: row.summary,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  }));
}

export async function updateProfile(id: string, updates: Partial<Profile>): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      name: updates.name,
      email: updates.email,
      phone: updates.phone,
      location: updates.location,
      summary: updates.summary,
    })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteProfile(id: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Document operations
export async function addDocument(document: Omit<Document, 'id' | 'createdAt'>): Promise<string> {
  const { data, error } = await supabase
    .from('documents')
    .insert({
      profile_id: document.profileId,
      name: document.name,
      type: document.type,
      content: document.content,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Supabase addDocument error:', error);
    throw new Error(`Failed to save document: ${error.message}`);
  }
  return data.id;
}

export async function getDocumentsByProfile(profileId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    type: row.type as 'cv' | 'experience' | 'other',
    content: row.content,
    createdAt: toDate(row.created_at),
  }));
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function updateDocument(id: string, updates: Partial<Document>): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({
      name: updates.name,
      type: updates.type,
      content: updates.content,
    })
    .eq('id', id);

  if (error) throw error;
}

// Cover letter operations
export async function saveCoverLetter(coverLetter: Omit<CoverLetter, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const { data, error } = await supabase
    .from('cover_letters')
    .insert({
      profile_id: coverLetter.profileId,
      job_title: coverLetter.jobTitle,
      company_name: coverLetter.companyName || '',
      job_description: coverLetter.jobDescription,
      content: coverLetter.content,
      executive_summary: coverLetter.executiveSummary || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function getCoverLettersByProfile(profileId: string): Promise<CoverLetter[]> {
  const { data, error } = await supabase
    .from('cover_letters')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    jobTitle: row.job_title,
    companyName: row.company_name,
    jobDescription: row.job_description,
    content: row.content,
    executiveSummary: row.executive_summary || undefined,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  }));
}

export async function getCoverLetter(id: string): Promise<CoverLetter | undefined> {
  const { data, error } = await supabase
    .from('cover_letters')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return undefined;

  return {
    id: data.id,
    profileId: data.profile_id,
    jobTitle: data.job_title,
    companyName: data.company_name,
    jobDescription: data.job_description,
    content: data.content,
    executiveSummary: data.executive_summary || undefined,
    createdAt: toDate(data.created_at),
    updatedAt: toDate(data.updated_at),
  };
}

export async function updateCoverLetter(id: string, updates: Partial<CoverLetter>): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (updates.jobTitle !== undefined) updateData.job_title = updates.jobTitle;
  if (updates.companyName !== undefined) updateData.company_name = updates.companyName;
  if (updates.jobDescription !== undefined) updateData.job_description = updates.jobDescription;
  if (updates.content !== undefined) updateData.content = updates.content;
  if (updates.executiveSummary !== undefined) updateData.executive_summary = updates.executiveSummary;

  const { error } = await supabase
    .from('cover_letters')
    .update(updateData)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteCoverLetter(id: string): Promise<void> {
  const { error } = await supabase
    .from('cover_letters')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Interview operations
export async function saveInterview(interview: Omit<InterviewResult, 'id' | 'createdAt'>): Promise<string> {
  const { data, error } = await supabase
    .from('interview_results')
    .insert({
      profile_id: interview.profileId,
      call_id: interview.callId,
      phone_number: interview.phoneNumber,
      status: interview.status,
      transcript: interview.transcript || null,
      summary: interview.summary || null,
      insights: interview.insights || null,
      completed_at: interview.completedAt?.toISOString() || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function getInterview(id: string): Promise<InterviewResult | undefined> {
  const { data, error } = await supabase
    .from('interview_results')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return undefined;

  return {
    id: data.id,
    profileId: data.profile_id,
    callId: data.call_id,
    phoneNumber: data.phone_number,
    status: data.status as 'pending' | 'in-progress' | 'completed' | 'failed',
    transcript: data.transcript || undefined,
    summary: data.summary || undefined,
    insights: data.insights || undefined,
    createdAt: toDate(data.created_at),
    completedAt: data.completed_at ? toDate(data.completed_at) : undefined,
  };
}

export async function getInterviewByCallId(callId: string): Promise<InterviewResult | undefined> {
  const { data, error } = await supabase
    .from('interview_results')
    .select('*')
    .eq('call_id', callId)
    .single();

  if (error || !data) return undefined;

  return {
    id: data.id,
    profileId: data.profile_id,
    callId: data.call_id,
    phoneNumber: data.phone_number,
    status: data.status as 'pending' | 'in-progress' | 'completed' | 'failed',
    transcript: data.transcript || undefined,
    summary: data.summary || undefined,
    insights: data.insights || undefined,
    createdAt: toDate(data.created_at),
    completedAt: data.completed_at ? toDate(data.completed_at) : undefined,
  };
}

export async function getInterviewsByProfile(profileId: string): Promise<InterviewResult[]> {
  const { data, error } = await supabase
    .from('interview_results')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    callId: row.call_id,
    phoneNumber: row.phone_number,
    status: row.status as 'pending' | 'in-progress' | 'completed' | 'failed',
    transcript: row.transcript || undefined,
    summary: row.summary || undefined,
    insights: row.insights || undefined,
    createdAt: toDate(row.created_at),
    completedAt: row.completed_at ? toDate(row.completed_at) : undefined,
  }));
}

export async function updateInterview(id: string, updates: Partial<InterviewResult>): Promise<void> {
  const { error } = await supabase
    .from('interview_results')
    .update({
      status: updates.status,
      transcript: updates.transcript,
      summary: updates.summary,
      insights: updates.insights,
      completed_at: updates.completedAt?.toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteInterview(id: string): Promise<void> {
  const { error } = await supabase
    .from('interview_results')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Interview guide cache operations
export async function saveInterviewGuide(guide: Omit<CachedInterviewGuide, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  // Delete any existing guide for this profile first
  await supabase
    .from('interview_guides')
    .delete()
    .eq('profile_id', guide.profileId);

  const { data, error } = await supabase
    .from('interview_guides')
    .insert({
      profile_id: guide.profileId,
      guide: guide.guide as unknown as Json,
      documents_hash: guide.documentsHash,
      status: guide.status,
      error: guide.error || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function getInterviewGuideByProfile(profileId: string): Promise<CachedInterviewGuide | undefined> {
  const { data, error } = await supabase
    .from('interview_guides')
    .select('*')
    .eq('profile_id', profileId)
    .single();

  if (error || !data) return undefined;

  return {
    id: data.id,
    profileId: data.profile_id,
    guide: data.guide as unknown as CachedInterviewGuide['guide'],
    documentsHash: data.documents_hash,
    status: data.status as 'generating' | 'ready' | 'failed',
    error: data.error || undefined,
    createdAt: toDate(data.created_at),
    updatedAt: toDate(data.updated_at),
  };
}

export async function updateInterviewGuide(id: string, updates: Partial<CachedInterviewGuide>): Promise<void> {
  const { error } = await supabase
    .from('interview_guides')
    .update({
      guide: updates.guide as unknown as Json,
      documents_hash: updates.documentsHash,
      status: updates.status,
      error: updates.error,
    })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteInterviewGuideByProfile(profileId: string): Promise<void> {
  const { error } = await supabase
    .from('interview_guides')
    .delete()
    .eq('profile_id', profileId);

  if (error) throw error;
}

// Interview Briefing operations
// Note: Using type assertions because interview_briefings table types need to be regenerated after migration
export async function saveInterviewBriefing(
  briefing: Omit<InterviewBriefing, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const { data, error } = await (supabase
    .from('interview_briefings' as 'profiles') as unknown as ReturnType<typeof supabase.from>)
    .insert({
      profile_id: briefing.profileId,
      job_title: briefing.jobTitle,
      company_name: briefing.companyName,
      job_description: briefing.jobDescription,
      company_url: briefing.companyUrl || null,
      company_research: briefing.companyResearch as unknown as Json || null,
      industry_analysis: briefing.industryAnalysis as unknown as Json || null,
      competitive_landscape: briefing.competitiveLandscape as unknown as Json || null,
      briefing_document: briefing.briefingDocument || null,
      interview_questions: briefing.interviewQuestions as unknown as Json || null,
      talking_points: briefing.talkingPoints as unknown as Json || null,
      podcast_script: briefing.podcastScript || null,
      audio_url: briefing.audioUrl || null,
      status: briefing.status,
      error: briefing.error || null,
    } as Record<string, unknown>)
    .select('id')
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

export async function getInterviewBriefing(id: string): Promise<InterviewBriefing | undefined> {
  const { data, error } = await (supabase
    .from('interview_briefings' as 'profiles') as unknown as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return undefined;

  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    jobTitle: row.job_title as string,
    companyName: row.company_name as string,
    jobDescription: row.job_description as string,
    companyUrl: (row.company_url as string) || undefined,
    companyResearch: row.company_research as CompanyResearch | undefined,
    industryAnalysis: row.industry_analysis as IndustryAnalysis | undefined,
    competitiveLandscape: row.competitive_landscape as CompetitiveLandscape | undefined,
    briefingDocument: (row.briefing_document as string) || undefined,
    interviewQuestions: row.interview_questions as InterviewQuestion[] | undefined,
    talkingPoints: row.talking_points as TalkingPoint[] | undefined,
    podcastScript: (row.podcast_script as string) || undefined,
    audioUrl: (row.audio_url as string) || undefined,
    status: row.status as InterviewBriefing['status'],
    error: (row.error as string) || undefined,
    createdAt: toDate(row.created_at as string),
    updatedAt: toDate(row.updated_at as string),
  };
}

export async function getInterviewBriefingsByProfile(profileId: string): Promise<InterviewBriefing[]> {
  const { data, error } = await (supabase
    .from('interview_briefings' as 'profiles') as unknown as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return ((data || []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    profileId: row.profile_id as string,
    jobTitle: row.job_title as string,
    companyName: row.company_name as string,
    jobDescription: row.job_description as string,
    companyUrl: (row.company_url as string) || undefined,
    companyResearch: row.company_research as CompanyResearch | undefined,
    industryAnalysis: row.industry_analysis as IndustryAnalysis | undefined,
    competitiveLandscape: row.competitive_landscape as CompetitiveLandscape | undefined,
    briefingDocument: (row.briefing_document as string) || undefined,
    interviewQuestions: row.interview_questions as InterviewQuestion[] | undefined,
    talkingPoints: row.talking_points as TalkingPoint[] | undefined,
    podcastScript: (row.podcast_script as string) || undefined,
    audioUrl: (row.audio_url as string) || undefined,
    status: row.status as InterviewBriefing['status'],
    error: (row.error as string) || undefined,
    createdAt: toDate(row.created_at as string),
    updatedAt: toDate(row.updated_at as string),
  }));
}

export async function updateInterviewBriefing(
  id: string,
  updates: Partial<InterviewBriefing>
): Promise<void> {
  const updateData: Record<string, unknown> = {};

  if (updates.jobTitle !== undefined) updateData.job_title = updates.jobTitle;
  if (updates.companyName !== undefined) updateData.company_name = updates.companyName;
  if (updates.jobDescription !== undefined) updateData.job_description = updates.jobDescription;
  if (updates.companyUrl !== undefined) updateData.company_url = updates.companyUrl;
  if (updates.companyResearch !== undefined) updateData.company_research = updates.companyResearch;
  if (updates.industryAnalysis !== undefined) updateData.industry_analysis = updates.industryAnalysis;
  if (updates.competitiveLandscape !== undefined) updateData.competitive_landscape = updates.competitiveLandscape;
  if (updates.briefingDocument !== undefined) updateData.briefing_document = updates.briefingDocument;
  if (updates.interviewQuestions !== undefined) updateData.interview_questions = updates.interviewQuestions;
  if (updates.talkingPoints !== undefined) updateData.talking_points = updates.talkingPoints;
  if (updates.podcastScript !== undefined) updateData.podcast_script = updates.podcastScript;
  if (updates.audioUrl !== undefined) updateData.audio_url = updates.audioUrl;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.error !== undefined) updateData.error = updates.error;

  const { error } = await (supabase
    .from('interview_briefings' as 'profiles') as unknown as ReturnType<typeof supabase.from>)
    .update(updateData)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteInterviewBriefing(id: string): Promise<void> {
  const { error } = await (supabase
    .from('interview_briefings' as 'profiles') as unknown as ReturnType<typeof supabase.from>)
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Tailored CV operations
export async function saveTailoredCV(
  cv: Omit<TailoredCV, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const { data, error } = await (supabase
    .from('tailored_cvs' as 'profiles') as unknown as ReturnType<typeof supabase.from>)
    .insert({
      profile_id: cv.profileId,
      job_title: cv.jobTitle,
      company_name: cv.companyName || '',
      job_description: cv.jobDescription,
      selected_template: cv.selectedTemplate,
      cv_data: cv.cvData as unknown as Json,
      language: cv.language || 'en',
      status: cv.status,
      error: cv.error || null,
    } as Record<string, unknown>)
    .select('id')
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

export async function getTailoredCV(id: string): Promise<TailoredCV | undefined> {
  const { data, error } = await (supabase
    .from('tailored_cvs' as 'profiles') as unknown as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return undefined;

  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    jobTitle: row.job_title as string,
    companyName: row.company_name as string,
    jobDescription: row.job_description as string,
    selectedTemplate: row.selected_template as TailoredCV['selectedTemplate'],
    cvData: row.cv_data as TailoredCVData,
    language: row.language as string,
    status: row.status as string,
    error: (row.error as string) || undefined,
    createdAt: toDate(row.created_at as string),
    updatedAt: toDate(row.updated_at as string),
  };
}

export async function getTailoredCVsByProfile(profileId: string): Promise<TailoredCV[]> {
  const { data, error } = await (supabase
    .from('tailored_cvs' as 'profiles') as unknown as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return ((data || []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    profileId: row.profile_id as string,
    jobTitle: row.job_title as string,
    companyName: row.company_name as string,
    jobDescription: row.job_description as string,
    selectedTemplate: row.selected_template as TailoredCV['selectedTemplate'],
    cvData: row.cv_data as TailoredCVData,
    language: row.language as string,
    status: row.status as string,
    error: (row.error as string) || undefined,
    createdAt: toDate(row.created_at as string),
    updatedAt: toDate(row.updated_at as string),
  }));
}

export async function updateTailoredCV(
  id: string,
  updates: Partial<TailoredCV>
): Promise<void> {
  const updateData: Record<string, unknown> = {};

  if (updates.jobTitle !== undefined) updateData.job_title = updates.jobTitle;
  if (updates.companyName !== undefined) updateData.company_name = updates.companyName;
  if (updates.jobDescription !== undefined) updateData.job_description = updates.jobDescription;
  if (updates.selectedTemplate !== undefined) updateData.selected_template = updates.selectedTemplate;
  if (updates.cvData !== undefined) updateData.cv_data = updates.cvData;
  if (updates.language !== undefined) updateData.language = updates.language;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.error !== undefined) updateData.error = updates.error;

  const { error } = await (supabase
    .from('tailored_cvs' as 'profiles') as unknown as ReturnType<typeof supabase.from>)
    .update(updateData)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteTailoredCV(id: string): Promise<void> {
  const { error } = await (supabase
    .from('tailored_cvs' as 'profiles') as unknown as ReturnType<typeof supabase.from>)
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Get unique jobs from cover letters for reuse in interview prep
export async function getPreviousJobs(profileId: string): Promise<PreviousJob[]> {
  const { data, error } = await supabase
    .from('cover_letters')
    .select('job_title, company_name, job_description, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Deduplicate by job_title + company_name combination
  const seen = new Set<string>();
  const uniqueJobs: PreviousJob[] = [];

  for (const row of data || []) {
    const key = `${row.job_title}|${row.company_name}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueJobs.push({
        jobTitle: row.job_title,
        companyName: row.company_name,
        jobDescription: row.job_description,
        createdAt: toDate(row.created_at),
      });
    }
  }

  return uniqueJobs;
}
