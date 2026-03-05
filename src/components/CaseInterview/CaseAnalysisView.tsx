import { useState } from 'react';
import type { CaseAnalysis } from '../../types';
import { CaseApproachCard } from './CaseApproachCard';
import { updateCaseAnalysis } from '../../services/caseInterview';

interface CaseAnalysisViewProps {
  analysis: CaseAnalysis;
  onRevealed: () => void;
  onPractice: () => void;
}

export function CaseAnalysisView({ analysis, onRevealed, onPractice }: CaseAnalysisViewProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);

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
          {/* Framework */}
          {analysis.framework && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                Framework: {analysis.framework.type}
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Hypothesis</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{analysis.framework.hypothesis}</p>
                </div>

                {/* Issue Tree */}
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Issue Tree (MECE)</p>
                  <div className="space-y-2">
                    {analysis.framework.issueTree.map((node, i) => (
                      <div key={i} className="border-l-2 border-blue-300 dark:border-blue-600 pl-3">
                        <p className="text-sm font-medium text-gray-800 dark:text-white">{node.branch}</p>
                        <div className="ml-3 mt-1 space-y-0.5">
                          {node.subBranches.map((sub, j) => (
                            <p key={j} className="text-xs text-gray-600 dark:text-gray-400">- {sub}</p>
                          ))}
                        </div>
                        {node.keyQuestions.length > 0 && (
                          <div className="ml-3 mt-1">
                            {node.keyQuestions.map((q, j) => (
                              <p key={j} className="text-xs text-blue-600 dark:text-blue-400 italic">? {q}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quantitative Anchors */}
                {analysis.framework.quantitativeAnchors.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Key Calculations</p>
                    <ul className="space-y-0.5">
                      {analysis.framework.quantitativeAnchors.map((a, i) => (
                        <li key={i} className="text-xs text-gray-600 dark:text-gray-400">- {a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3 Approaches */}
          {analysis.approaches.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                3 Solution Approaches
              </h3>
              <div className="space-y-3">
                {analysis.approaches.map((approach, i) => (
                  <CaseApproachCard key={i} approach={approach} index={i} />
                ))}
              </div>
            </div>
          )}

          {/* Key Metrics */}
          {analysis.keyMetrics.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                Key Metrics & Data Points
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <ul className="space-y-1">
                  {analysis.keyMetrics.map((m, i) => (
                    <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">#</span>
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Pitfalls */}
          {analysis.pitfalls.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                Common Pitfalls to Avoid
              </h3>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                <ul className="space-y-1">
                  {analysis.pitfalls.map((p, i) => (
                    <li key={i} className="text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                      <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {p}
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
