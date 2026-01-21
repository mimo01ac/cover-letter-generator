import type { CoverLetterFeedback } from '../../types';

interface FeedbackAnalysisProps {
  feedback: CoverLetterFeedback | null;
  isLoading: boolean;
  language: 'en' | 'da';
}

export function FeedbackAnalysis({ feedback, isLoading, language }: FeedbackAnalysisProps) {
  const t = {
    title: language === 'da' ? 'Feedback & Analyse' : 'Feedback & Analysis',
    matchScore: language === 'da' ? 'Match Score' : 'Match Score',
    suggestions: language === 'da' ? 'Forbedringsforslag' : 'Improvement Suggestions',
    missingKeywords: language === 'da' ? 'Manglende nøgleord' : 'Missing Keywords',
    strengths: language === 'da' ? 'Styrker' : 'Strengths',
    analyzing: language === 'da' ? 'Analyserer ansøgning...' : 'Analyzing cover letter...',
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
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
          <span className="text-gray-600 dark:text-gray-400">{t.analyzing}</span>
        </div>
      </div>
    );
  }

  if (!feedback) {
    return null;
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        {t.title}
      </h2>

      {/* Match Score */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t.matchScore}
          </span>
          <span className={`text-2xl font-bold ${getScoreColor(feedback.matchScore)}`}>
            {feedback.matchScore}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${getScoreBarColor(feedback.matchScore)}`}
            style={{ width: `${feedback.matchScore}%` }}
          />
        </div>
      </div>

      {/* Strengths */}
      {feedback.strengths.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t.strengths}
          </h3>
          <ul className="space-y-1">
            {feedback.strengths.map((strength, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {strength}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestions */}
      {feedback.suggestions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t.suggestions}
          </h3>
          <ul className="space-y-3">
            {feedback.suggestions.map((suggestion, index) => (
              <li key={index} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100 text-sm">
                      {suggestion.title}
                    </p>
                    <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
                      {suggestion.description}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Missing Keywords */}
      {feedback.missingKeywords.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t.missingKeywords}
          </h3>
          <div className="flex flex-wrap gap-2">
            {feedback.missingKeywords.map((keyword, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-sm rounded-md"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
