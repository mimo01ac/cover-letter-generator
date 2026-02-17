import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../stores/useStore';
import { getCoverLettersByProfile, deleteCoverLetter, getAllProfiles } from '../../services/db';
import { ChatRefinement } from './ChatRefinement';
import { FeedbackAnalysis } from './FeedbackAnalysis';
import { analyzeCoverLetter } from '../../services/feedbackAnalyzer';
import { detectLanguage } from '../../utils/languageDetection';
import type { CoverLetter, Profile, CoverLetterFeedback } from '../../types';

export function HistoryPage() {
  const navigate = useNavigate();
  const { currentProfile, setCurrentProfile, setCurrentLetter, clearChat } = useStore();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([]);
  const [selectedLetter, setSelectedLetter] = useState<CoverLetter | null>(null);
  const [displayedContent, setDisplayedContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<CoverLetterFeedback | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    if (currentProfile?.id) {
      loadCoverLetters(currentProfile.id);
    }
  }, [currentProfile?.id]);

  const loadProfiles = async () => {
    try {
      const allProfiles = await getAllProfiles();
      setProfiles(allProfiles);
      if (allProfiles.length > 0 && !currentProfile) {
        setCurrentProfile(allProfiles[0]);
      } else if (allProfiles.length === 0) {
        // No profile exists - redirect to profile page
        navigate('/profile');
        return;
      }
    } catch (err) {
      console.error('Failed to load profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCoverLetters = async (profileId: string) => {
    try {
      const letters = await getCoverLettersByProfile(profileId);
      setCoverLetters(letters);
    } catch (err) {
      console.error('Failed to load cover letters:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this cover letter?')) {
      return;
    }

    setDeleting(id);
    try {
      await deleteCoverLetter(id);
      setCoverLetters(coverLetters.filter((l) => l.id !== id));
      if (selectedLetter?.id === id) {
        setSelectedLetter(null);
        setDisplayedContent('');
      }
    } catch (err) {
      console.error('Failed to delete cover letter:', err);
    } finally {
      setDeleting(null);
    }
  };

  const handleSelectLetter = (letter: CoverLetter) => {
    setSelectedLetter(letter);
    setDisplayedContent(letter.content);
    setCurrentLetter(letter.content);
    clearChat();
    setFeedback(null);
  };

  const handleAnalyze = async () => {
    if (!selectedLetter) return;

    setIsAnalyzing(true);
    try {
      const language = detectLanguage(selectedLetter.content);

      const feedbackResult = await analyzeCoverLetter({
        coverLetter: displayedContent,
        jobDescription: selectedLetter.jobDescription,
        jobTitle: selectedLetter.jobTitle,
        language,
      });
      setFeedback(feedbackResult);
    } catch (err) {
      console.error('Failed to analyze cover letter:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLetterUpdated = (updatedContent: string) => {
    setDisplayedContent(updatedContent);
    if (selectedLetter) {
      setSelectedLetter({
        ...selectedLetter,
        content: updatedContent,
      });
    }
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          Cover Letter History
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

      {coverLetters.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow">
          <svg
            className="w-16 h-16 mx-auto text-gray-400 mb-4"
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
          <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">
            No cover letters yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Generated cover letters will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Letter List */}
          <div className="lg:col-span-1 space-y-3">
            {coverLetters.map((letter) => (
              <div
                key={letter.id}
                onClick={() => handleSelectLetter(letter)}
                className={`p-4 rounded-lg cursor-pointer transition-colors ${
                  selectedLetter?.id === letter.id
                    ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-white">
                      {letter.companyName || 'Unknown Company'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {letter.jobTitle}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {formatDate(letter.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(letter.id!);
                    }}
                    disabled={deleting === letter.id}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    {deleting === letter.id ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
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
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Letter Preview */}
          <div className="lg:col-span-2 space-y-4">
            {selectedLetter ? (
              <>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                      {selectedLetter.companyName || 'Unknown Company'}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">
                      {selectedLetter.jobTitle}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(displayedContent)}
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
                </div>

                {/* Paper Document */}
                <div className="paper-document rounded-lg whitespace-pre-wrap text-base leading-relaxed max-h-[50vh] overflow-y-auto">
                  {displayedContent}
                </div>

                {/* Analyze Button */}
                {!feedback && !isAnalyzing && (
                  <button
                    onClick={handleAnalyze}
                    className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Analyze Cover Letter
                  </button>
                )}

                {/* Feedback Analysis */}
                {(feedback || isAnalyzing) && (
                  <FeedbackAnalysis
                    feedback={feedback}
                    isLoading={isAnalyzing}
                    language={detectLanguage(selectedLetter.content)}
                  />
                )}

                {/* Chat Refinement */}
                <ChatRefinement
                  jobDescription={selectedLetter.jobDescription}
                  jobTitle={selectedLetter.jobTitle}
                  companyName={selectedLetter.companyName}
                  initialLetter={displayedContent}
                  onLetterUpdated={handleLetterUpdated}
                />

              </>
            ) : (
              <div className="flex items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-xl shadow text-gray-400">
                Select a cover letter to view
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
