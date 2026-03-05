import { useState } from 'react';
import type { CaseInterviewFeedback } from '../../types';

interface CaseInterviewFeedbackReportProps {
  feedback: CaseInterviewFeedback;
}

function scoreColor(score: number): string {
  if (score >= 8) return 'text-green-600 dark:text-green-400';
  if (score >= 6) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 8) return 'bg-green-100 dark:bg-green-900/30';
  if (score >= 6) return 'bg-yellow-100 dark:bg-yellow-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
}

function scoreBarColor(score: number): string {
  if (score >= 8) return 'bg-green-500';
  if (score >= 6) return 'bg-yellow-500';
  return 'bg-red-500';
}

function SubScoreRow({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-1">
          <div className={`h-1 rounded-full ${scoreBarColor(score)}`} style={{ width: `${score * 10}%` }} />
        </div>
        <span className={`font-bold ${scoreColor(score)}`}>{score}</span>
      </div>
    </div>
  );
}

export function CaseInterviewFeedbackReport({ feedback }: CaseInterviewFeedbackReportProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggle = (id: string) => setExpandedSection(expandedSection === id ? null : id);

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="text-center py-6">
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${scoreBg(feedback.overallScore)}`}>
          <span className={`text-3xl font-bold ${scoreColor(feedback.overallScore)}`}>
            {feedback.overallScore}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Overall Case Performance (out of 10)</p>
      </div>

      {/* Category Scores */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
          Performance by Category
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {feedback.categoryScores.map((cat) => (
            <div key={cat.category} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-800 dark:text-white">{cat.category}</span>
                <span className={`text-sm font-bold ${scoreColor(cat.score)}`}>{cat.score}/10</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mb-2">
                <div className={`h-1.5 rounded-full ${scoreBarColor(cat.score)}`} style={{ width: `${cat.score * 10}%` }} />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">{cat.comment}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Analysis Sections */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
          Detailed Analysis
        </h3>

        {/* Structure Analysis */}
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
          <button onClick={() => toggle('structure')} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <span className="text-sm font-medium text-gray-800 dark:text-white">Problem Structuring</span>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${scoreColor(feedback.structureAnalysis.meceScore)}`}>MECE: {feedback.structureAnalysis.meceScore}/10</span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedSection === 'structure' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          {expandedSection === 'structure' && (
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
              <p className="text-xs text-gray-500 dark:text-gray-400"><strong>Framework used:</strong> {feedback.structureAnalysis.framework}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{feedback.structureAnalysis.comment}</p>
            </div>
          )}
        </div>

        {/* Communication */}
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
          <button onClick={() => toggle('communication')} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <span className="text-sm font-medium text-gray-800 dark:text-white">Communication Quality</span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedSection === 'communication' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSection === 'communication' && (
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
              <SubScoreRow label="Clarity" score={feedback.communicationAnalysis.clarity} />
              <SubScoreRow label="Top-down structure" score={feedback.communicationAnalysis.topDown} />
              <SubScoreRow label="Signposting" score={feedback.communicationAnalysis.signposting} />
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{feedback.communicationAnalysis.comment}</p>
            </div>
          )}
        </div>

        {/* Quantitative */}
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
          <button onClick={() => toggle('quantitative')} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <span className="text-sm font-medium text-gray-800 dark:text-white">Quantitative Skills</span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedSection === 'quantitative' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSection === 'quantitative' && (
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
              <SubScoreRow label="Math accuracy" score={feedback.quantitativeAnalysis.mathAccuracy} />
              <SubScoreRow label="Structured approach" score={feedback.quantitativeAnalysis.structuredApproach} />
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{feedback.quantitativeAnalysis.comment}</p>
            </div>
          )}
        </div>

        {/* Synthesis */}
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
          <button onClick={() => toggle('synthesis')} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <span className="text-sm font-medium text-gray-800 dark:text-white">Synthesis & Recommendation</span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedSection === 'synthesis' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSection === 'synthesis' && (
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
              <SubScoreRow label="Actionable" score={feedback.synthesisFeedback.actionable} />
              <SubScoreRow label="Evidence-backed" score={feedback.synthesisFeedback.supported} />
              <SubScoreRow label="Concise" score={feedback.synthesisFeedback.concise} />
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{feedback.synthesisFeedback.comment}</p>
            </div>
          )}
        </div>

        {/* Industry Relevance (if available) */}
        {feedback.industryRelevance && (
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
            <button onClick={() => toggle('industry')} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <span className="text-sm font-medium text-gray-800 dark:text-white">Industry Relevance</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${scoreColor(feedback.industryRelevance.score)}`}>{feedback.industryRelevance.score}/10</span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedSection === 'industry' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            {expandedSection === 'industry' && (
              <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">{feedback.industryRelevance.comment}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comparison to approaches (if available) */}
      {feedback.comparisonToApproaches && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">Comparison to Suggested Approaches</h3>
          <p className="text-sm text-blue-700 dark:text-blue-400">{feedback.comparisonToApproaches}</p>
        </div>
      )}

      {/* Strengths & Improvements */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Strengths</h3>
          <ul className="space-y-1">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Areas for Improvement</h3>
          <ul className="space-y-1">
            {feedback.areasForImprovement.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {a}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action Items */}
      {feedback.actionItems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Action Items</h3>
          <ol className="space-y-1 list-decimal list-inside">
            {feedback.actionItems.map((item, i) => (
              <li key={i} className="text-sm text-gray-700 dark:text-gray-300">{item}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
