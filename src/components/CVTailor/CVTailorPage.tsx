import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../stores/useStore';
import { getAllProfiles, getDocumentsByProfile, getPreviousJobs, getCoverLettersByProfile } from '../../services/db';
import { generateTailoredCV } from '../../services/cvTailor';
import { scrapeJobPosting } from '../../services/jobScraper';
import { downloadTailoredCVAsWord } from '../../utils/wordExport';
import { saveApplicationPackage, getBaseFolderName, changeBaseFolder, clearBaseFolder, hasFileSystemAccess, acquireDirectoryHandle } from '../../utils/applicationPackage';
import type { CVGenerationCallbacks } from '../../services/cvTailor';
import { TemplateSelector } from './TemplateSelector';
import { CVPreview } from './CVPreview';
import { CVHistory } from './CVHistory';
import { CVRefinement } from './CVRefinement';
import { CoverLetterPicker } from './CoverLetterPicker';
import type { Profile, PreviousJob, TailoredCVData, CVTemplate, CoverLetter } from '../../types';

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
  const [selectedJobKey, setSelectedJobKey] = useState<string | null>(null);

  // Save package state
  const cvPreviewRef = useRef<HTMLDivElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [matchedLetters, setMatchedLetters] = useState<CoverLetter[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState('');
  const [saveProgressPercent, setSaveProgressPercent] = useState(0);
  const [baseFolderName, setBaseFolderName] = useState<string | null>(null);

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

  // Load base folder name on mount
  useEffect(() => {
    if (hasFileSystemAccess()) {
      getBaseFolderName().then(setBaseFolderName);
    }
  }, []);

  const handleChangeBaseFolder = async () => {
    try {
      const name = await changeBaseFolder();
      if (name) setBaseFolderName(name);
    } catch {
      // Picker failed (permission lost, browser blocked it, etc.) — clear the stale handle
      await clearBaseFolder();
      setBaseFolderName(null);
    }
  };

  const handleClearBaseFolder = async () => {
    await clearBaseFolder();
    setBaseFolderName(null);
  };

  // Ref to hold the directory handle acquired during the click gesture
  const dirHandleRef = useRef<FileSystemDirectoryHandle | undefined>(undefined);

  const handleSavePackage = async () => {
    if (!cvData || !currentProfile?.id) return;

    // Acquire filesystem permission NOW — while user gesture is still active
    try {
      dirHandleRef.current = await acquireDirectoryHandle();
    } catch {
      dirHandleRef.current = undefined;
    }

    try {
      const letters = await getCoverLettersByProfile(currentProfile.id);
      const matches = letters.filter(l =>
        companyName && l.companyName.toLowerCase() === companyName.toLowerCase()
      );

      if (matches.length === 1) {
        // Exact single match — use it directly
        await executeSave(matches[0]);
      } else if (matches.length > 1) {
        // Multiple matches — let user pick
        setMatchedLetters(matches);
        setShowPicker(true);
      } else {
        // No matching cover letter — save CV only
        await executeSave(undefined);
      }
    } catch {
      // If lookup fails, fall back to CV only
      await executeSave(undefined);
    }
  };

  const handlePickerSelect = async (coverLetter: CoverLetter) => {
    setShowPicker(false);
    await executeSave(coverLetter);
  };

  const handlePickerCVOnly = async () => {
    setShowPicker(false);
    await executeSave(undefined);
  };

  const executeSave = async (coverLetter: CoverLetter | undefined) => {
    if (!cvData || !currentProfile || !cvPreviewRef.current) return;

    setIsSaving(true);
    setSaveProgress('Starting...');
    setSaveProgressPercent(0);

    try {
      const result = await saveApplicationPackage(
        {
          cvData,
          profile: currentProfile,
          template: selectedTemplate,
          jobTitle,
          companyName,
          coverLetter,
          cvPreviewElement: cvPreviewRef.current,
        },
        (step, progress) => {
          setSaveProgress(step);
          setSaveProgressPercent(progress);
        },
        dirHandleRef.current
      );

      setSaveProgress(`Saved ${result.fileCount} files to "${result.folderName}"`);
      setSaveProgressPercent(1);

      // Refresh folder name in case it was first pick
      if (hasFileSystemAccess()) {
        const name = await getBaseFolderName();
        setBaseFolderName(name);
      }

      // Clear progress after a delay
      setTimeout(() => {
        setIsSaving(false);
        setSaveProgress('');
        setSaveProgressPercent(0);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setIsSaving(false);
      setSaveProgress('');
      setSaveProgressPercent(0);
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

                {/* If no previous jobs, go straight into new-job mode */}
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
                  </>
                )}

                {/* Shared fields — visible when any job is selected (or no previous jobs) */}
                {(selectedJobKey || previousJobs.length === 0) && (
                  <>
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
                  </>
                )}
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
              {/* Template Selector + Actions */}
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
                  <span className="flex flex-col leading-tight">
                    <span>CV .docx</span>
                  </span>
                </button>
                <button
                  onClick={handleSavePackage}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  <span className="flex flex-col leading-tight">
                    <span>Save Package</span>
                    <span className="text-purple-200 text-xs font-normal">CV + Cover Letter, .docx & .pdf</span>
                  </span>
                </button>
              </div>

              {/* Save progress + folder indicator */}
              {(isSaving || (hasFileSystemAccess() && baseFolderName)) && (
                <div className="flex items-center gap-3 text-sm">
                  {isSaving ? (
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-purple-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.round(saveProgressPercent * 100)}%` }}
                        />
                      </div>
                      <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {saveProgress}
                      </span>
                    </div>
                  ) : hasFileSystemAccess() && baseFolderName ? (
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span>{baseFolderName}</span>
                      <button
                        onClick={handleChangeBaseFolder}
                        className="text-purple-600 dark:text-purple-400 hover:underline text-xs"
                      >
                        Change
                      </button>
                      <span className="text-gray-300 dark:text-gray-600">|</span>
                      <button
                        onClick={handleClearBaseFolder}
                        className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:underline text-xs"
                      >
                        Reset
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {/* CV Preview */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
                <div className="overflow-auto max-h-[800px] border border-gray-200 dark:border-gray-700 rounded-xl">
                  <div ref={cvPreviewRef}>
                    <CVPreview
                      cvData={cvData}
                      profile={currentProfile}
                      selectedTemplate={selectedTemplate}
                    />
                  </div>
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

      {/* Cover Letter Picker Modal */}
      {showPicker && (
        <CoverLetterPicker
          coverLetters={matchedLetters}
          companyName={companyName}
          onSelect={handlePickerSelect}
          onCVOnly={handlePickerCVOnly}
          onCancel={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
