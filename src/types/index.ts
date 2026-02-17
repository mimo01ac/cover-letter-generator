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
  executiveSummary?: string;
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

// Interview Prep Types
export type InterviewBriefingStatus = 'researching' | 'generating' | 'ready' | 'failed';

export interface CompanyResearch {
  mission?: string;
  values?: string[];
  culture?: string;
  strategy?: string;
  recentNews?: string[];
  keyPeople?: Array<{ name: string; title: string }>;
  fundingStage?: string;
  employeeCount?: string;
  founded?: string;
  headquarters?: string;
}

export interface IndustryAnalysis {
  trends?: string[];
  challenges?: string[];
  regulations?: string[];
  outlook?: string;
  keyMetrics?: string[];
}

export interface CompetitiveLandscape {
  competitors?: Array<{
    name: string;
    description?: string;
    differentiation?: string;
  }>;
  marketPosition?: string;
  competitiveAdvantages?: string[];
}

export interface InterviewQuestion {
  category: 'behavioral' | 'technical' | 'situational' | 'company-specific' | 'role-specific';
  question: string;
  suggestedAnswer: string;
  tips?: string;
}

export interface TalkingPoint {
  situation: string;
  task: string;
  action: string;
  result: string;
  relevantFor: string[];
}

export interface InterviewBriefing {
  id?: string;
  profileId: string;

  // Input data
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  companyUrl?: string;

  // Research data
  companyResearch?: CompanyResearch;
  industryAnalysis?: IndustryAnalysis;
  competitiveLandscape?: CompetitiveLandscape;

  // Generated content
  briefingDocument?: string;
  interviewQuestions?: InterviewQuestion[];
  talkingPoints?: TalkingPoint[];
  podcastScript?: string;

  // Audio
  audioUrl?: string;

  // Metadata
  status: InterviewBriefingStatus;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterviewPrepGenerationRequest {
  profileId: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  companyUrl?: string;
}

export interface InterviewPrepRefinementRequest {
  briefingId: string;
  section: 'briefing' | 'questions' | 'talking_points' | 'podcast';
  userRequest: string;
  conversationHistory: ChatMessage[];
}

// CV Tailoring Types
export type CVTemplate = 'classic' | 'hybrid' | 'executive';

export interface CVExperienceEntry {
  company: string;
  title: string;
  period: string;
  location?: string;
  bullets: string[];
}

export interface CVEducationEntry {
  institution: string;
  degree: string;
  period: string;
  details?: string;
}

export interface TailoredCVData {
  headline: string;
  executiveSummary: string;
  careerHighlights: string[];
  coreCompetencies: string[];
  experience: CVExperienceEntry[];
  education: CVEducationEntry[];
  certifications?: string[];
  languages?: string[];
}

export interface TailoredCV {
  id?: string;
  profileId: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  selectedTemplate: CVTemplate;
  cvData: TailoredCVData;
  language: string;
  status: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CVTailorGenerationRequest {
  profileId: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  language?: 'en' | 'da';
  customNotes?: string;
  selectedTemplate?: CVTemplate;
}

// Job from previous cover letters (for reuse)
export interface PreviousJob {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  createdAt: Date;
}
