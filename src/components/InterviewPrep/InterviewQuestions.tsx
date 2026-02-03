import { useState } from 'react';
import type { InterviewQuestion } from '../../types';

interface InterviewQuestionsProps {
  questions: InterviewQuestion[];
  briefingId: string | null;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  behavioral: { label: 'Behavioral', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  technical: { label: 'Technical', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  situational: { label: 'Situational', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  'company-specific': { label: 'Company', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  'role-specific': { label: 'Role', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
};

export function InterviewQuestions({ questions, briefingId: _briefingId }: InterviewQuestionsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  if (!questions || questions.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        <p>Interview questions will appear here once generated.</p>
      </div>
    );
  }

  // Get unique categories from questions
  const categories = [...new Set(questions.map((q) => q.category))];

  const filteredQuestions = filterCategory === 'all'
    ? questions
    : questions.filter((q) => q.category === filterCategory);

  const handleCopyQuestion = async (question: InterviewQuestion) => {
    const text = `Question: ${question.question}\n\nSuggested Answer: ${question.suggestedAnswer}${question.tips ? `\n\nTips: ${question.tips}` : ''}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="p-6">
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filterCategory === 'all'
              ? 'bg-gray-800 text-white dark:bg-white dark:text-gray-800'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          All ({questions.length})
        </button>
        {categories.map((cat) => {
          const catInfo = CATEGORY_LABELS[cat] || { label: cat, color: 'bg-gray-100 text-gray-700' };
          const count = questions.filter((q) => q.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterCategory === cat
                  ? 'bg-gray-800 text-white dark:bg-white dark:text-gray-800'
                  : `${catInfo.color} hover:opacity-80`
              }`}
            >
              {catInfo.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Questions List */}
      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        {filteredQuestions.map((question, index) => {
          const catInfo = CATEGORY_LABELS[question.category] || { label: question.category, color: 'bg-gray-100 text-gray-700' };
          const isExpanded = expandedIndex === index;

          return (
            <div
              key={index}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Question Header */}
              <button
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
                className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${catInfo.color}`}>
                    {catInfo.label}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 dark:text-white">
                    {question.question}
                  </p>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Answer Panel */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Suggested Answer
                      </h4>
                      <button
                        onClick={() => handleCopyQuestion(question)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Copy question and answer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                      {question.suggestedAnswer}
                    </p>

                    {question.tips && (
                      <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          <div>
                            <h5 className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">Tips</h5>
                            <p className="text-xs text-amber-700 dark:text-amber-400">{question.tips}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
