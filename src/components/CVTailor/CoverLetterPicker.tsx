import type { CoverLetter } from '../../types';

interface CoverLetterPickerProps {
  coverLetters: CoverLetter[];
  companyName: string;
  onSelect: (coverLetter: CoverLetter) => void;
  onCVOnly: () => void;
  onCancel: () => void;
}

export function CoverLetterPicker({ coverLetters, companyName, onSelect, onCVOnly, onCancel }: CoverLetterPickerProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            Multiple Cover Letters Found
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {coverLetters.length} cover letters match "{companyName}". Pick one to include.
          </p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {coverLetters.map(letter => (
            <button
              key={letter.id}
              onClick={() => onSelect(letter)}
              className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <div className="font-medium text-gray-800 dark:text-white text-sm">
                {letter.jobTitle}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {letter.companyName} &middot; {new Date(letter.createdAt).toLocaleDateString()}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                {letter.content.slice(0, 150)}...
              </p>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={onCVOnly}
            className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
          >
            CV Only
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
