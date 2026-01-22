import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../stores/useStore';
import { generateCoverLetter } from '../../services/claude';
import { saveCoverLetter, getAllProfiles, getDocumentsByProfile } from '../../services/db';
import { ChatRefinement } from './ChatRefinement';
import { FeedbackAnalysis } from './FeedbackAnalysis';
import { detectLanguage } from '../../utils/languageDetection';
import { scrapeJobPosting } from '../../services/jobScraper';
import { analyzeCoverLetter } from '../../services/feedbackAnalyzer';
import type { Profile, CoverLetterFeedback } from '../../types';

export function Generator() {
  const navigate = useNavigate();
  const {
    currentProfile,
    setCurrentProfile,
    documents,
    setDocuments,
    isGenerating,
    setIsGenerating,
    setCurrentLetter,
    clearChat,
  } = useStore();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [generatedLetter, setGeneratedLetter] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<'en' | 'da'>('en');
  const [detectedLanguage, setDetectedLanguage] = useState<'en' | 'da' | null>(null);
  const [jobUrl, setJobUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [feedback, setFeedback] = useState<CoverLetterFeedback | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (currentProfile?.id) {
      loadDocuments(currentProfile.id);
    }
  }, [currentProfile?.id]);

  const loadData = async () => {
    try {
      const allProfiles = await getAllProfiles();
      setProfiles(allProfiles);
      if (allProfiles.length > 0 && !currentProfile) {
        setCurrentProfile(allProfiles[0]);
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

  const handleJobDescriptionChange = (value: string) => {
    setJobDescription(value);
    
    // Detect language when job description is provided
    if (value.trim().length > 50) {
      const detected = detectLanguage(value);
      setDetectedLanguage(detected);
      setLanguage(detected);
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
      handleJobDescriptionChange(scrapedData.jobDescription);
      setJobUrl(''); // Clear the URL input after successful scrape
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scrape URL');
    } finally {
      setIsScraping(false);
    }
  };

  const handleGenerate = async () => {
    setError('');
    setFeedback(null);

    if (!currentProfile) {
      setError('Please create a profile first');
      return;
    }

    if (!jobTitle.trim() || !jobDescription.trim()) {
      setError('Please enter both job title and job description');
      return;
    }

    setIsGenerating(true);
    setGeneratedLetter('');

    try {
      const letter = await generateCoverLetter(
        {
          profile: currentProfile,
          documents,
          jobTitle: jobTitle.trim(),
          companyName: companyName.trim(),
          jobDescription: jobDescription.trim(),
          language,
          customNotes: customNotes.trim(),
        },
        (text) => setGeneratedLetter(text)
      );

      setGeneratedLetter(letter);

      // Save to database
      await saveCoverLetter({
        profileId: currentProfile.id!,
        jobTitle: jobTitle.trim(),
        companyName: companyName.trim(),
        jobDescription: jobDescription.trim(),
        content: letter,
      });

      // Set up for refinement
      setCurrentLetter(letter);
      clearChat();

      // Automatically analyze the generated cover letter
      setIsAnalyzing(true);
      try {
        const feedbackResult = await analyzeCoverLetter({
          coverLetter: letter,
          jobDescription: jobDescription.trim(),
          jobTitle: jobTitle.trim(),
          language,
        });
        setFeedback(feedbackResult);
      } catch (feedbackErr) {
        console.error('Failed to analyze cover letter:', feedbackErr);
        // Don't show error to user - feedback is optional
      } finally {
        setIsAnalyzing(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate cover letter');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedLetter);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([generatedLetter], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cover-letter-${companyName || 'job'}-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
          Create a profile with your information and upload your CV to generate personalized cover letters.
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          Generate Cover Letter
        </h1>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
            Job Details
          </h2>

          {/* URL Scraper */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Paste Job Posting URL (optional)
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Must be a publicly accessible URL. Links requiring login (e.g., LinkedIn) will not work.
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://example.com/job-posting"
                disabled={isScraping}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50"
              />
              <button
                onClick={handleScrapeUrl}
                disabled={isScraping || !jobUrl.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isScraping ? (
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  'Scrape'
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Job Title *
            </label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="Senior Software Engineer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="Acme Inc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Job Description *
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => handleJobDescriptionChange(e.target.value)}
              rows={12}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
              placeholder="Paste the full job description here..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Custom Notes (optional)
            </label>
            <textarea
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
              placeholder="E.g., Focus on my leadership experience, don't mention my gap year, emphasize Python skills..."
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Add specific instructions to guide the AI when writing your cover letter
            </p>
          </div>

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
              <option value="da">Danish (Dansk)</option>
            </select>
            {detectedLanguage && detectedLanguage !== language && (
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                Detected: {detectedLanguage === 'da' ? 'Danish' : 'English'} (can be overridden above)
              </p>
            )}
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Generating...
              </>
            ) : (
              'Generate Cover Letter'
            )}
          </button>

          <div className="text-sm text-gray-500 dark:text-gray-400">
            Using profile: <strong>{currentProfile.name}</strong>
            {documents.length > 0 && (
              <span> with {documents.length} document(s)</span>
            )}
          </div>
        </div>

        {/* Output Section - Paper Document Style */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
              Generated Cover Letter
            </h2>
            {generatedLetter && (
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Copy to clipboard"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
                <button
                  onClick={handleDownload}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Download as text file"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {generatedLetter ? (
            <div className="paper-document rounded-lg whitespace-pre-wrap text-base leading-relaxed">
              {generatedLetter}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-12 flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
              <div className="text-center">
                <svg
                  className="w-12 h-12 mx-auto mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p>Your cover letter will appear here</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Analysis Section */}
      {(generatedLetter || isAnalyzing) && (
        <FeedbackAnalysis
          feedback={feedback}
          isLoading={isAnalyzing}
          language={language}
        />
      )}

      {/* Chat Refinement Section */}
      {generatedLetter && (
        <div>
          <ChatRefinement
            jobDescription={jobDescription}
            jobTitle={jobTitle}
            companyName={companyName}
            initialLetter={generatedLetter}
            language={language}
            onLetterUpdated={(letter) => {
              setGeneratedLetter(letter);
            }}
          />
        </div>
      )}
    </div>
  );
}
