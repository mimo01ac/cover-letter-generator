import { useState, useEffect } from 'react';
import { getInterviewBriefingsByProfile, deleteInterviewBriefing } from '../../services/db';
import type { InterviewBriefing, InterviewQuestion, TalkingPoint } from '../../types';

interface BriefingHistoryProps {
  profileId: string;
  onLoadBriefing: (briefing: {
    id: string;
    briefingDocument?: string;
    interviewQuestions?: InterviewQuestion[];
    talkingPoints?: TalkingPoint[];
    podcastScript?: string;
    jobTitle: string;
    companyName: string;
    jobDescription: string;
    companyUrl?: string;
  }) => void;
  currentBriefingId: string | null;
}

export function BriefingHistory({ profileId, onLoadBriefing, currentBriefingId }: BriefingHistoryProps) {
  const [briefings, setBriefings] = useState<InterviewBriefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadBriefings();
  }, [profileId]);

  const loadBriefings = async () => {
    try {
      const data = await getInterviewBriefingsByProfile(profileId);
      setBriefings(data);
    } catch (err) {
      console.error('Failed to load briefings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInterviewBriefing(id);
      setBriefings((prev) => prev.filter((b) => b.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete briefing:', err);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const getStatusColor = (status: InterviewBriefing['status']) => {
    switch (status) {
      case 'ready':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'generating':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'researching':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      case 'failed':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
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

  if (briefings.length === 0) {
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
          <span className="font-medium text-gray-800 dark:text-white">Previous Briefings</span>
          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
            {briefings.length}
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
            {briefings.map((briefing) => (
              <div
                key={briefing.id}
                className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                  currentBriefingId === briefing.id
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() =>
                      onLoadBriefing({
                        id: briefing.id!,
                        briefingDocument: briefing.briefingDocument,
                        interviewQuestions: briefing.interviewQuestions,
                        talkingPoints: briefing.talkingPoints,
                        podcastScript: briefing.podcastScript,
                        jobTitle: briefing.jobTitle,
                        companyName: briefing.companyName,
                        jobDescription: briefing.jobDescription,
                        companyUrl: briefing.companyUrl,
                      })
                    }
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-800 dark:text-white text-sm">
                        {briefing.jobTitle}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getStatusColor(briefing.status)}`}>
                        {briefing.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {briefing.companyName} &middot; {formatDate(briefing.createdAt)}
                    </p>
                  </button>

                  {deleteConfirm === briefing.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(briefing.id!)}
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
                      onClick={() => setDeleteConfirm(briefing.id!)}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Delete briefing"
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
