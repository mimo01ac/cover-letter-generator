import { useState } from 'react';
import type { CaseApproach } from '../../types';

interface CaseApproachCardProps {
  approach: CaseApproach;
  index: number;
}

export function CaseApproachCard({ approach, index }: CaseApproachCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const colors = [
    { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300' },
    { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800', badge: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300' },
    { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300' },
  ];
  const color = colors[index % colors.length];

  return (
    <div className={`border ${color.border} rounded-lg overflow-hidden`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full text-left px-4 py-3 ${color.bg} hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color.badge}`}>
              #{index + 1}
            </span>
            <span className="font-medium text-gray-800 dark:text-white text-sm">
              {approach.name}
            </span>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{approach.angle}</p>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-gray-700 pt-3">
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Opening Structure</h4>
            <p className="text-sm text-gray-700 dark:text-gray-300">{approach.openingStructure}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Key Analyses</h4>
            <ul className="space-y-1">
              {approach.keyAnalyses.map((a, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">-</span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Recommendation Direction</h4>
            <p className="text-sm text-gray-700 dark:text-gray-300">{approach.recommendation}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Risks</h4>
            <ul className="space-y-1">
              {approach.risks.map((r, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                  <svg className="w-3 h-3 text-amber-500 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                  </svg>
                  {r}
                </li>
              ))}
            </ul>
          </div>
          <div className={`${color.bg} rounded-lg p-3`}>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Best When</h4>
            <p className="text-sm text-gray-700 dark:text-gray-300">{approach.bestWhen}</p>
          </div>
        </div>
      )}
    </div>
  );
}
