import { useState, useEffect } from 'react';
import { getTailoredCVsByProfile, deleteTailoredCV } from '../../services/db';
import type { TailoredCV, TailoredCVData, CVTemplate } from '../../types';

interface CVHistoryProps {
  profileId: string;
  onLoadCV: (cv: {
    id: string;
    cvData: TailoredCVData;
    selectedTemplate: CVTemplate;
    jobTitle: string;
    companyName: string;
    jobDescription: string;
    language: string;
  }) => void;
  currentCVId: string | null;
}

export function CVHistory({ profileId, onLoadCV, currentCVId }: CVHistoryProps) {
  const [cvs, setCVs] = useState<TailoredCV[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadCVs();
  }, [profileId]);

  const loadCVs = async () => {
    try {
      const data = await getTailoredCVsByProfile(profileId);
      setCVs(data.filter(cv => cv.status === 'ready'));
    } catch (err) {
      console.error('Failed to load tailored CVs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTailoredCV(id);
      setCVs((prev) => prev.filter((cv) => cv.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete CV:', err);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (cvs.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium text-gray-800 dark:text-white">Previous CVs</span>
          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
            {cvs.length}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          <div className="max-h-64 overflow-y-auto">
            {cvs.map((cv) => (
              <div
                key={cv.id}
                className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                  currentCVId === cv.id
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() =>
                      onLoadCV({
                        id: cv.id!,
                        cvData: cv.cvData,
                        selectedTemplate: cv.selectedTemplate,
                        jobTitle: cv.jobTitle,
                        companyName: cv.companyName,
                        jobDescription: cv.jobDescription,
                        language: cv.language,
                      })
                    }
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-800 dark:text-white text-sm">
                        {cv.jobTitle}
                      </span>
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                        {cv.selectedTemplate}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {cv.companyName} &middot; {formatDate(cv.createdAt)}
                    </p>
                  </button>

                  {deleteConfirm === cv.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(cv.id!)}
                        className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="Confirm delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Cancel"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(cv.id!)}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Delete CV"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
