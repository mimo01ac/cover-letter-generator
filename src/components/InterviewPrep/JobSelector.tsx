import { useState } from 'react';
import type { PreviousJob } from '../../types';

interface JobSelectorProps {
  previousJobs: PreviousJob[];
  onJobSelect: (job: PreviousJob | null) => void;
}

export function JobSelector({ previousJobs, onJobSelect }: JobSelectorProps) {
  const [mode, setMode] = useState<'select' | 'new'>('new');
  const [selectedJobKey, setSelectedJobKey] = useState<string>('');

  const handleModeChange = (newMode: 'select' | 'new') => {
    setMode(newMode);
    if (newMode === 'new') {
      setSelectedJobKey('');
      onJobSelect(null);
    }
  };

  const handleJobChange = (key: string) => {
    setSelectedJobKey(key);
    if (key) {
      const [jobTitle, companyName] = key.split('|');
      const job = previousJobs.find(
        (j) => j.jobTitle === jobTitle && j.companyName === companyName
      );
      if (job) {
        onJobSelect(job);
      }
    } else {
      onJobSelect(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleModeChange('new')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            mode === 'new'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Job
          </div>
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('select')}
          disabled={previousJobs.length === 0}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            mode === 'select'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Previous Job
            {previousJobs.length > 0 && (
              <span className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs px-1.5 py-0.5 rounded-full">
                {previousJobs.length}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Previous Job Selector */}
      {mode === 'select' && previousJobs.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Select a job from your history
          </label>
          <select
            value={selectedJobKey}
            onChange={(e) => handleJobChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="">Choose a job...</option>
            {previousJobs.map((job, index) => {
              const key = `${job.jobTitle}|${job.companyName}`;
              return (
                <option key={`${key}-${index}`} value={key}>
                  {job.jobTitle} at {job.companyName}
                </option>
              );
            })}
          </select>
          {selectedJobKey && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Job details loaded from your cover letter history
            </p>
          )}
        </div>
      )}

      {/* Info text for new job mode */}
      {mode === 'new' && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Enter the job details below to generate a new interview briefing pack.
        </p>
      )}
    </div>
  );
}
