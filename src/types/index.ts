export interface Profile {
  id?: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id?: string;
  profileId: string;
  name: string;
  type: 'cv' | 'experience' | 'other';
  content: string;
  createdAt: Date;
}

export interface CoverLetter {
  id?: string;
  profileId: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ConversationState {
  coverLetterId: string;
  messages: ChatMessage[];
  currentLetter: string;
}

export interface GenerationRequest {
  profile: Profile;
  documents: Document[];
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  language?: 'en' | 'da';
  customNotes?: string;
}

export interface RefinementRequest {
  currentLetter: string;
  conversationHistory: ChatMessage[];
  userRequest: string;
  profile: Profile;
  documents: Document[];
  jobDescription: string;
  language?: 'en' | 'da';
}

export interface FeedbackSuggestion {
  title: string;
  description: string;
}

export interface CoverLetterFeedback {
  matchScore: number;
  suggestions: FeedbackSuggestion[];
  missingKeywords: string[];
  strengths: string[];
}

export interface InterviewQuestion {
  topic: string;
  question: string;
  followUps: string[];
}

export interface InterviewGuide {
  introduction: string;
  questions: InterviewQuestion[];
  closing: string;
}

export interface InterviewResult {
  id?: string;
  profileId: string;
  callId: string;
  phoneNumber: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  transcript?: string;
  summary?: string;
  insights?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface CachedInterviewGuide {
  id?: string;
  profileId: string;
  guide: InterviewGuide;
  documentsHash: string;
  status: 'generating' | 'ready' | 'failed';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExtractedSkill {
  skill: string;
  source: string;
  context: string;
  confidence: 'explicit' | 'demonstrated' | 'mentioned';
}

export interface ExtractedAchievement {
  description: string;
  metrics?: string;
  source: string;
}

export interface ExtractedCredential {
  type: 'degree' | 'certification' | 'title';
  name: string;
  source: string;
}

export interface CandidateFactInventory {
  skills: ExtractedSkill[];
  achievements: ExtractedAchievement[];
  credentials: ExtractedCredential[];
  companies: string[];
}
