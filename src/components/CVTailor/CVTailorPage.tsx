import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../stores/useStore';
import { getAllProfiles, getDocumentsByProfile, getPreviousJobs } from '../../services/db';
import { generateTailoredCV } from '../../services/cvTailor';
import { scrapeJobPosting } from '../../services/jobScraper';
import { downloadTailoredCVAsWord } from '../../utils/wordExport';
import type { CVGenerationCallbacks } from '../../services/cvTailor';
import { TemplateSelector } from './TemplateSelector';
import { CVPreview } from './CVPreview';
import { CVHistory } from './CVHistory';
import { CVRefinement } from './CVRefinement';
import type { Profile, PreviousJob, TailoredCVData, CVTemplate } from '../../types';

export function CVTailorPage() {
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
  const [language, setLanguage] = useState<'en' | 'da'>('en');
  const [customNotes, setCustomNotes] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState('');
  const [tailoredCVId, setTailoredCVId] = useState<string | null>(null);

  // CV state
  const [cvData, setCvData] = useState<TailoredCVData | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<CVTemplate>('classic');

  // UI state
  const [isInputCollapsed, setIsInputCollapsed] = useState(false);

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
      setJobUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scrape URL');
    } finally {
      setIsScraping(false);
    }
  };

  const handleJobSelect = (key: string) => {
    if (key) {
      const [title, company] = key.split('|');
      const job = previousJobs.find(j => j.jobTitle === title && j.companyName === company);
      if (job) {
        setJobTitle(job.jobTitle);
        setCompanyName(job.companyName);
        setJobDescription(job.jobDescription);
      }
    }
  };

  const handleGenerate = async () => {
    setError('');

    if (!currentProfile) {
      setError('Please create a profile first');
      return;
    }

    if (!jobTitle.trim() || !jobDescription.trim()) {
      setError('Please enter job title and job description');
      return;
    }

    setIsGenerating(true);
    setCvData(null);
    setTailoredCVId(null);

    const callbacks: CVGenerationCallbacks = {
      onStatus: (_phase, message) => {
        setGenerationMessage(message);
      },
      onCVId: (id) => {
        setTailoredCVId(id);
      },
      onCVData: (data) => {
        setCvData(data);
      },
      onError: (errorMsg) => {
        setError(errorMsg);
      },
    };

    try {
      await generateTailoredCV(
        {
          profileId: currentProfile.id!,
          jobTitle: jobTitle.trim(),
          companyName: companyName.trim(),
          jobDescription: jobDescription.trim(),
          language,
          customNotes: customNotes.trim() || undefined,
          selectedTemplate,
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
      setGenerationMessage('');
    }
  };

  const handleLoadCV = (cv: {
    id: string;
    cvData: TailoredCVData;
    selectedTemplate: CVTemplate;
    jobTitle: string;
    companyName: string;
    jobDescription: string;
    language: string;
  }) => {
    setTailoredCVId(cv.id);
    setCvData(cv.cvData);
    setSelectedTemplate(cv.selectedTemplate);
    setJobTitle(cv.jobTitle);
    setCompanyName(cv.companyName);
    setJobDescription(cv.jobDescription);
    setLanguage(cv.language as 'en' | 'da');
    setIsInputCollapsed(true);
  };

  const handleDownloadWord = async () => {
    if (!cvData || !currentProfile) return;
    try {
      await downloadTailoredCVAsWord(cvData, currentProfile, selectedTemplate, jobTitle, companyName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
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
          Create a profile and upload your CV to generate a tailored CV.
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            CV Tailor
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Generate a targeted CV tailored to a specific job posting
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

                {/* Previous Jobs Selector */}
                {previousJobs.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Or select from previous jobs
                    </label>
                    <select
                      onChange={(e) => handleJobSelect(e.target.value)}
                      defaultValue=""
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Choose a previous job...</option>
                      {previousJobs.map((job, index) => {
                        const key = `${job.jobTitle}|${job.companyName}`;
                        return (
                          <option key={`${key}-${index}`} value={key}>
                            {job.jobTitle} at {job.companyName}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

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
                    Company Name
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

                {/* Language */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as 'en' | 'da')}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    <option value="en">English</option>
                    <option value="da">Danish</option>
                  </select>
                </div>

                {/* Custom Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    rows={2}
                    placeholder="Any special instructions..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Tailor CV
                    </>
                  )}
                </button>

                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Using profile: <strong>{currentProfile.name}</strong>
                  {documents.length > 0 && <span> with {documents.length} document(s)</span>}
                </div>
              </div>
            </div>
          </div>

          {/* History */}
          {currentProfile && (
            <CVHistory
              profileId={currentProfile.id!}
              onLoadCV={handleLoadCV}
              currentCVId={tailoredCVId}
            />
          )}

          {/* Refinement */}
          {cvData && tailoredCVId && (
            <CVRefinement
              cvId={tailoredCVId}
              cvData={cvData}
              jobDescription={jobDescription}
              language={language}
              onCVUpdated={(data) => setCvData(data)}
            />
          )}
        </div>

        {/* Right Column - CV Preview */}
        <div className="lg:col-span-2">
          {cvData ? (
            <div className="space-y-4">
              {/* Template Selector + Download */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <TemplateSelector
                    selectedTemplate={selectedTemplate}
                    onSelect={setSelectedTemplate}
                  />
                </div>
                <button
                  onClick={handleDownloadWord}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download .docx
                </button>
              </div>

              {/* CV Preview */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
                <div className="overflow-auto max-h-[800px] border border-gray-200 dark:border-gray-700 rounded-xl">
                  <CVPreview
                    cvData={cvData}
                    profile={currentProfile}
                    selectedTemplate={selectedTemplate}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                Tailor Your CV for Any Role
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Enter a job posting and we'll restructure your CV to highlight the most relevant experience. Choose from 3 professional templates.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
                <div className="flex items-start gap-3 text-left p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-white text-sm">Rewritten</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Bullets tailored to role</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-left p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-white text-sm">3 Templates</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Switch instantly</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-left p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800 dark:text-white text-sm">Word Export</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Download .docx</p>
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
