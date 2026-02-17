import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../stores/useStore';
import { getAllProfiles, getDocumentsByProfile, getPreviousJobs } from '../../services/db';
import { generateInterviewBriefing } from '../../services/interviewPrep';
import { scrapeJobPosting } from '../../services/jobScraper';
import type { GenerationCallbacks } from '../../services/interviewPrep';
import { BriefingDocument } from './BriefingDocument';
import { InterviewQuestions } from './InterviewQuestions';
import { TalkingPoints } from './TalkingPoints';
import { AudioBriefing } from './AudioBriefing';
import { BriefingHistory } from './BriefingHistory';
import type { Profile, PreviousJob, InterviewQuestion, TalkingPoint } from '../../types';

type ActiveTab = 'briefing' | 'questions' | 'talking_points' | 'audio' | 'history';

export function InterviewPrepPage() {
  const navigate = useNavigate();
  const { currentProfile, setCurrentProfile, documents, setDocuments } = useStore();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [previousJobs, setPreviousJobs] = useState<PreviousJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState('');
  const [generationMessage, setGenerationMessage] = useState('');
  const [briefingId, setBriefingId] = useState<string | null>(null);

  // Generated content
  const [briefingDocument, setBriefingDocument] = useState('');
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestion[]>([]);
  const [talkingPoints, setTalkingPoints] = useState<TalkingPoint[]>([]);
  const [podcastScript, setPodcastScript] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);

  // UI state
  const [activeTab, setActiveTab] = useState<ActiveTab>('briefing');
  const [isInputCollapsed, setIsInputCollapsed] = useState(false);
  const [selectedJobKey, setSelectedJobKey] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (currentProfile?.id) {
      loadDocuments(currentProfile.id);
      loadPreviousJobs(currentProfile.id);
    }
  }, [currentProfile?.id]);

  const loadData = async () => {
    try {
      const allProfiles = await getAllProfiles();
      setProfiles(allProfiles);
      if (allProfiles.length > 0 && !currentProfile) {
        setCurrentProfile(allProfiles[0]);
      } else if (allProfiles.length === 0) {
        navigate('/profile');
        return;
      }
    } catch (err) {
      console.error('Failed to load profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async (profileId: string) => {
    try {
      const docs = await getDocumentsByProfile(profileId);
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  const loadPreviousJobs = async (profileId: string) => {
    try {
      const jobs = await getPreviousJobs(profileId);
      setPreviousJobs(jobs);
    } catch (err) {
      console.error('Failed to load previous jobs:', err);
    }
  };

  const handleScrapeUrl = async () => {
    if (!jobUrl.trim()) {
      setError('Please enter a URL');
      return;
    }

    setError('');
    setIsScraping(true);

    try {
      const scrapedData = await scrapeJobPosting(jobUrl);
      setJobTitle(scrapedData.jobTitle);
      setCompanyName(scrapedData.companyName);
      setJobDescription(scrapedData.jobDescription);
      if (scrapedData.companyUrl) {
        setCompanyUrl(scrapedData.companyUrl);
      }
      setJobUrl(''); // Clear the URL input after successful scrape
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scrape URL');
    } finally {
      setIsScraping(false);
    }
  };

  const handleGenerate = async () => {
    setError('');

    if (!currentProfile) {
      setError('Please create a profile first');
      return;
    }

    if (!jobTitle.trim() || !jobDescription.trim() || !companyName.trim()) {
      setError('Please enter job title, company name, and job description');
      return;
    }

    setIsGenerating(true);
    setBriefingDocument('');
    setInterviewQuestions([]);
    setTalkingPoints([]);
    setPodcastScript('');
    setAudioUrl(undefined);
    setBriefingId(null);

    const callbacks: GenerationCallbacks = {
      onStatus: (phase, message) => {
        setGenerationPhase(phase);
        setGenerationMessage(message);
      },
      onBriefingId: (id) => {
        setBriefingId(id);
      },
      onBriefing: (text) => {
        setBriefingDocument(text);
      },
      onQuestions: (questions) => {
        setInterviewQuestions(questions);
      },
      onTalkingPoints: (points) => {
        setTalkingPoints(points);
      },
      onPodcast: (text) => {
        setPodcastScript(text);
      },
      onError: (errorMsg) => {
        setError(errorMsg);
      },
    };

    try {
      await generateInterviewBriefing(
        {
          profileId: currentProfile.id!,
          jobTitle: jobTitle.trim(),
          companyName: companyName.trim(),
          jobDescription: jobDescription.trim(),
          companyUrl: companyUrl.trim() || undefined,
        },
        currentProfile,
        documents,
        callbacks
      );

      setIsInputCollapsed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
      setGenerationPhase('');
      setGenerationMessage('');
    }
  };

  const handleLoadBriefing = (briefing: {
    id: string;
    briefingDocument?: string;
    interviewQuestions?: InterviewQuestion[];
    talkingPoints?: TalkingPoint[];
    podcastScript?: string;
    audioUrl?: string;
    jobTitle: string;
    companyName: string;
    jobDescription: string;
    companyUrl?: string;
  }) => {
    setBriefingId(briefing.id);
    setBriefingDocument(briefing.briefingDocument || '');
    setInterviewQuestions(briefing.interviewQuestions || []);
    setTalkingPoints(briefing.talkingPoints || []);
    setPodcastScript(briefing.podcastScript || '');
    setAudioUrl(briefing.audioUrl);
    setJobTitle(briefing.jobTitle);
    setCompanyName(briefing.companyName);
    setJobDescription(briefing.jobDescription);
    setCompanyUrl(briefing.companyUrl || '');
    setIsInputCollapsed(true);
    setActiveTab('briefing');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="max-w-2xl mx-auto bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Profile Required
        </h2>
        <p className="text-blue-700 dark:text-blue-300 mb-4">
          Create a profile and upload your CV to generate interview preparation materials.
        </p>
        <button
          onClick={() => navigate('/profile')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create Profile
        </button>
      </div>
    );
  }

  const hasContent = briefingDocument || interviewQuestions.length > 0 || talkingPoints.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Interview Preparation
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Generate a comprehensive briefing pack for your interview
          </p>
        </div>
        {profiles.length > 1 && (
          <select
            value={currentProfile?.id || ''}
            onChange={(e) => {
              const profile = profiles.find((p) => p.id === e.target.value);
              if (profile) setCurrentProfile(profile);
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Input Form */}
        <div className="lg:col-span-1 space-y-4">
          {/* Job Input Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            <button
              onClick={() => setIsInputCollapsed(!isInputCollapsed)}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                Job Details
              </h2>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                  isInputCollapsed ? '' : 'rotate-180'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div
              className={`transition-all duration-300 ease-in-out ${
                isInputCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[2000px] opacity-100'
              }`}
            >
              <div className="px-6 pb-6 space-y-4 border-t border-gray-100 dark:border-gray-700">
                {/* Job Selector — scrollable list of previous jobs + New Job */}
                {previousJobs.length > 0 && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select a job
                    </label>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {previousJobs.map((job, index) => {
                        const key = `${job.jobTitle}|${job.companyName}`;
                        const isSelected = selectedJobKey === key;
                        return (
                          <button
                            key={`${key}-${index}`}
                            onClick={() => {
                              setSelectedJobKey(key);
                              setJobTitle(job.jobTitle);
                              setCompanyName(job.companyName);
                              setJobDescription(job.jobDescription);
                              setCompanyUrl('');
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                          >
                            <div className="font-medium text-sm text-gray-800 dark:text-white truncate">
                              {job.jobTitle}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                              <span className="truncate">{job.companyName}</span>
                              <span className="shrink-0">{new Date(job.createdAt).toLocaleDateString()}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {/* + New Job button */}
                    <button
                      onClick={() => {
                        if (selectedJobKey === 'new') {
                          setSelectedJobKey(null);
                        } else {
                          setSelectedJobKey('new');
                          setJobTitle('');
                          setCompanyName('');
                          setJobDescription('');
                          setCompanyUrl('');
                        }
                      }}
                      className={`w-full mt-2 text-left px-3 py-2.5 rounded-lg border border-dashed transition-colors flex items-center gap-2 ${
                        selectedJobKey === 'new'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">New Job</span>
                    </button>
                  </div>
                )}

                {/* If no previous jobs, show full form directly */}
                {previousJobs.length === 0 && (
                  <>
                    {/* URL Scraper */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Import from URL
                      </label>
                      <div className="space-y-2">
                        <input
                          type="url"
                          value={jobUrl}
                          onChange={(e) => setJobUrl(e.target.value)}
                          placeholder="Paste job posting URL..."
                          disabled={isScraping}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50 text-sm"
                        />
                        <button
                          onClick={handleScrapeUrl}
                          disabled={isScraping || !jobUrl.trim()}
                          className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium"
                        >
                          {isScraping ? (
                            <>
                              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Importing...
                            </>
                          ) : (
                            'Import Job Details'
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Job Title */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Job Title *
                      </label>
                      <input
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="Senior Software Engineer"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                    </div>

                    {/* Company Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Acme Inc."
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                    </div>

                    {/* Job Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Job Description *
                      </label>
                      <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        rows={6}
                        placeholder="Paste the full job description here..."
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                      />
                    </div>
                  </>
                )}

                {/* Selected previous job — compact summary */}
                {selectedJobKey && selectedJobKey !== 'new' && previousJobs.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 text-sm">
                    <span className="font-medium text-gray-800 dark:text-white">{jobTitle}</span>
                    {companyName && (
                      <span className="text-gray-500 dark:text-gray-400"> @ {companyName}</span>
                    )}
                  </div>
                )}

                {/* New Job mode — full form fields */}
                {selectedJobKey === 'new' && previousJobs.length > 0 && (
                  <>
                    {/* URL Scraper */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Import from URL
                      </label>
                      <div className="space-y-2">
                        <input
                          type="url"
                          value={jobUrl}
                          onChange={(e) => setJobUrl(e.target.value)}
                          placeholder="Paste job posting URL..."
                          disabled={isScraping}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50 text-sm"
                        />
                        <button
                          onClick={handleScrapeUrl}
                          disabled={isScraping || !jobUrl.trim()}
                          className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium"
                        >
                          {isScraping ? (
                            <>
                              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Importing...
                            </>
                          ) : (
                            'Import Job Details'
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Job Title */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Job Title *
                      </label>
                      <input
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="Senior Software Engineer"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                    </div>

                    {/* Company Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Acme Inc."
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                    </div>

                    {/* Job Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Job Description *
                      </label>
                      <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        rows={6}
                        placeholder="Paste the full job description here..."
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                      />
                    </div>
                  </>
                )}

                {/* Shared fields — visible when any job is selected (or no previous jobs) */}
                {(selectedJobKey || previousJobs.length === 0) && (
                  <>
                    {/* Company URL */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Company Website (optional)
                      </label>
                      <input
                        type="url"
                        value={companyUrl}
                        onChange={(e) => setCompanyUrl(e.target.value)}
                        placeholder="https://company.com"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      />
                    </div>

                    {error && <p className="text-red-500 text-sm">{error}</p>}

                    {/* Generate Button */}
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isGenerating ? (
                        <>
                          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          {generationMessage || 'Generating...'}
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          Generate Briefing Pack
                        </>
                      )}
                    </button>

                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Using profile: <strong>{currentProfile.name}</strong>
                      {documents.length > 0 && <span> with {documents.length} document(s)</span>}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* History Section */}
          {currentProfile && (
            <BriefingHistory
              profileId={currentProfile.id!}
              onLoadBriefing={handleLoadBriefing}
              currentBriefingId={briefingId}
            />
          )}
        </div>

        {/* Right Column - Generated Content */}
        <div className="lg:col-span-2">
          {hasContent ? (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                {[
                  { id: 'briefing', label: 'Briefing', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                  { id: 'questions', label: 'Questions', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                  { id: 'talking_points', label: 'Stories', icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
                  { id: 'audio', label: 'Audio', icon: 'M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as ActiveTab)}
                    className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                    </svg>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow">
                {activeTab === 'briefing' && (
                  <BriefingDocument
                    content={briefingDocument}
                    briefingId={briefingId}
                    isGenerating={isGenerating && generationPhase === 'generating'}
                  />
                )}
                {activeTab === 'questions' && (
                  <InterviewQuestions
                    questions={interviewQuestions}
                    briefingId={briefingId}
                  />
                )}
                {activeTab === 'talking_points' && (
                  <TalkingPoints
                    talkingPoints={talkingPoints}
                    briefingId={briefingId}
                  />
                )}
                {activeTab === 'audio' && (
                  <AudioBriefing
                    podcastScript={podcastScript}
                    briefingId={briefingId}
                    savedAudioUrl={audioUrl}
                  />
                )}
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                Ready to Prepare for Your Interview?
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Select a job from your history or enter new job details, then generate a comprehensive briefing pack including company research, tailored questions, and STAR-format stories.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
                <div className="flex items-start gap-3 text-left p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-white text-sm">Company Brief</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Research & insights</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-left p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-white text-sm">12-15 Questions</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">With tailored answers</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-left p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-white text-sm">STAR Stories</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">From your experience</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-left p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-white text-sm">Audio Briefing</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Listen on the go</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
