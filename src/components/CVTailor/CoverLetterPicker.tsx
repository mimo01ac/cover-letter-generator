import { useState, useEffect } from 'react';
import { getCoverLettersByProfile } from '../../services/db';
import type { CoverLetter } from '../../types';

interface CoverLetterPickerProps {
  profileId: string;
  companyName: string;
  onSelect: (coverLetter: CoverLetter) => void;
  onCVOnly: () => void;
  onCancel: () => void;
}

export function CoverLetterPicker({ profileId, companyName, onSelect, onCVOnly, onCancel }: CoverLetterPickerProps) {
  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCoverLetters();
  }, [profileId]);

  const loadCoverLetters = async () => {
    try {
      const letters = await getCoverLettersByProfile(profileId);
      setCoverLetters(letters);
    } catch (err) {
      console.error('Failed to load cover letters:', err);
    } finally {
      setLoading(false);
    }
  };

  const matchesCompany = (letter: CoverLetter) =>
    companyName && letter.companyName.toLowerCase().includes(companyName.toLowerCase());

  // Sort: matching company first, then by date
  const sorted = [...coverLetters].sort((a, b) => {
    const aMatch = matchesCompany(a) ? 0 : 1;
    const bMatch = matchesCompany(b) ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            Select Cover Letter
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Choose a cover letter to include in the application package, or save CV only.
          </p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No cover letters found. You can save the CV only.
              </p>
            </div>
          ) : (
            sorted.map(letter => (
              <button
                key={letter.id}
                onClick={() => onSelect(letter)}
                className={`w-full text-left p-3 rounded-lg border transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                  matchesCompany(letter)
                    ? 'border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800 dark:text-white text-sm">
                    {letter.jobTitle}
                  </span>
                  {matchesCompany(letter) && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                      Match
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {letter.companyName} &middot; {new Date(letter.createdAt).toLocaleDateString()}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                  {letter.content.slice(0, 150)}...
                </p>
              </button>
            ))
          )}
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
