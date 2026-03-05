import { useState } from 'react';
import type { CaseAnalysis } from '../../types';
import { updateCaseAnalysis } from '../../services/caseInterview';

interface CaseAnalysisViewProps {
  analysis: CaseAnalysis;
  onRevealed: () => void;
  onPractice: () => void;
}

export function CaseAnalysisView({ analysis, onRevealed, onPractice }: CaseAnalysisViewProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  const handleReveal = async () => {
    if (!analysis.id) return;
    setIsRevealing(true);
    try {
      await updateCaseAnalysis(analysis.id, { solutionsRevealed: true });
      onRevealed();
    } catch (err) {
      console.error('Failed to reveal solutions:', err);
    } finally {
      setIsRevealing(false);
      setShowConfirm(false);
    }
  };

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedSections(new Set(analysis.sections.map((_, i) => i)));
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Case Summary — always visible */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
          Case Summary
        </h3>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{analysis.summary}</p>
        </div>
      </div>

      {/* Two CTAs when not yet revealed */}
      {!analysis.solutionsRevealed && (
        <div className="flex gap-3">
          <button
            onClick={onPractice}
            className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Practice First
          </button>
          <button
            onClick={() => setShowConfirm(true)}
            className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Reveal Solutions
          </button>
        </div>
      )}

      {/* Confirm Dialog */}
      {showConfirm && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Are you sure you want to reveal the suggested solutions? If you want to practice your own approach first, try the mock case interview before revealing.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleReveal}
              disabled={isRevealing}
              className="px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {isRevealing ? 'Revealing...' : 'Reveal Solutions'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Revealed Content */}
      {analysis.solutionsRevealed && (
        <>
          {/* Sections */}
          {analysis.sections.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Section-by-Section Analysis ({analysis.sections.length})
                </h3>
                <div className="flex gap-2">
                  <button onClick={expandAll} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    Expand all
                  </button>
                  <span className="text-xs text-gray-400">|</span>
                  <button onClick={collapseAll} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    Collapse all
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {analysis.sections.map((section, i) => {
                  const isExpanded = expandedSections.has(i);
                  return (
                    <div key={i} className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleSection(i)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-gray-800 dark:text-white">{section.title}</span>
                        </div>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {isExpanded && (
                        <div className="px-4 py-4 space-y-4">
                          {/* Context */}
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Why this matters</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{section.context}</p>
                          </div>

                          {/* Very Good Answer */}
                          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase">Very Good Answer</p>
                            </div>
                            <p className="text-sm text-green-900 dark:text-green-200 whitespace-pre-wrap">{section.veryGoodAnswer}</p>
                          </div>

                          {/* Exceptional Addition */}
                          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                              </svg>
                              <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase">Exceptional Addition</p>
                            </div>
                            <p className="text-sm text-purple-900 dark:text-purple-200 whitespace-pre-wrap">{section.exceptionalAddition}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Executive Tips */}
          {analysis.executiveTips.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                Executive Tips
              </h3>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <ul className="space-y-2">
                  {analysis.executiveTips.map((tip, i) => (
                    <li key={i} className="text-sm text-blue-900 dark:text-blue-200 flex items-start gap-2">
                      <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
