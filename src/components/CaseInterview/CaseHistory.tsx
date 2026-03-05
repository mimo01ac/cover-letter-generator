import type { CaseAnalysis } from '../../types';

interface CaseHistoryProps {
  analyses: CaseAnalysis[];
  onSelect: (analysis: CaseAnalysis) => void;
  selectedId: string | null;
}

export function CaseHistory({ analyses, onSelect, selectedId }: CaseHistoryProps) {
  if (analyses.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">No case analyses yet. Upload a case to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {analyses.map((a) => (
        <button
          key={a.id}
          onClick={() => onSelect(a)}
          className={`w-full text-left px-4 py-3 rounded-lg transition-colors border ${
            selectedId === a.id
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{a.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {a.createdAt.toLocaleDateString()}
                {a.solutionsRevealed && ' — Solutions revealed'}
              </p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ml-2 ${
              a.status === 'ready'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : a.status === 'analyzing'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            }`}>
              {a.status}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
