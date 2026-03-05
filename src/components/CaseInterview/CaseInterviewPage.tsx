import { useState, useEffect } from 'react';
import { useStore } from '../../stores/useStore';
import { useAuth } from '../../contexts/AuthContext';
import { getInterviewBriefingsByProfile, getDocumentsByProfile } from '../../services/db';
import { generateCaseAnalysis, getCaseAnalysesByProfile, getCaseAnalysis } from '../../services/caseInterview';
import { CaseUpload } from './CaseUpload';
import { CaseAnalysisView } from './CaseAnalysisView';
import { MockCaseInterview } from './MockCaseInterview';
import { CaseHistory } from './CaseHistory';
import type { CaseAnalysis, InterviewBriefing, Document } from '../../types';

type ActiveTab = 'upload' | 'practice' | 'solutions' | 'history';

export function CaseInterviewPage() {
  const { currentProfile } = useStore();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<ActiveTab>('upload');
  const [briefings, setBriefings] = useState<InterviewBriefing[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [analyses, setAnalyses] = useState<CaseAnalysis[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<CaseAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [linkedBriefing, setLinkedBriefing] = useState<InterviewBriefing | null>(null);

  // Load briefings, documents, and case history
  useEffect(() => {
    if (!currentProfile?.id) return;

    getInterviewBriefingsByProfile(currentProfile.id)
      .then(setBriefings)
      .catch(() => {});

    getDocumentsByProfile(currentProfile.id)
      .then(setDocuments)
      .catch(() => {});

    getCaseAnalysesByProfile(currentProfile.id)
      .then((data) => {
        setAnalyses(data);
        // Auto-select the most recent ready analysis
        const latest = data.find((a) => a.status === 'ready');
        if (latest && !currentAnalysis) {
          setCurrentAnalysis(latest);
          const linked = briefings.find((b) => b.id === latest.briefingId);
          if (linked) setLinkedBriefing(linked);
        }
      })
      .catch(() => {});
  }, [currentProfile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnalyze = async (title: string, caseContent: string, briefingId: string | null) => {
    if (!currentProfile?.id) return;

    setIsAnalyzing(true);
    setStatusMessage('Starting analysis...');
    setCurrentAnalysis(null);

    try {
      let caseId: string | null = null;

      await generateCaseAnalysis(currentProfile.id, title, caseContent, briefingId, {
        onStatus: (_phase, message) => setStatusMessage(message),
        onCaseId: (id) => { caseId = id; },
        onSummary: (text) => {
          setCurrentAnalysis((prev) => ({
            ...(prev || {
              profileId: currentProfile.id!,
              briefingId,
              title,
              caseContent,
              framework: null,
              approaches: [],
              keyMetrics: [],
              pitfalls: [],
              solutionsRevealed: false,
              status: 'analyzing' as const,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
            id: caseId || prev?.id,
            summary: (prev?.summary || '') + text,
          }));
        },
        onSummaryDone: () => {
          // Summary streaming done, now fetch the full analysis from DB
          if (caseId) {
            getCaseAnalysis(caseId).then((full) => {
              if (full) {
                setCurrentAnalysis(full);
                setAnalyses((prev) => [full, ...prev.filter((a) => a.id !== full.id)]);
              }
            });
          }
        },
        onError: (message) => setStatusMessage(`Error: ${message}`),
        onComplete: () => {
          setIsAnalyzing(false);
          setStatusMessage('');
          // Final fetch to ensure we have all data
          if (caseId) {
            getCaseAnalysis(caseId).then((full) => {
              if (full) {
                setCurrentAnalysis(full);
                setAnalyses((prev) => [full, ...prev.filter((a) => a.id !== full.id)]);
              }
            });
          }
        },
      });

      // Set linked briefing
      if (briefingId) {
        const linked = briefings.find((b) => b.id === briefingId);
        if (linked) setLinkedBriefing(linked);
      } else {
        setLinkedBriefing(null);
      }

      setActiveTab('solutions');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Analysis failed');
      setIsAnalyzing(false);
    }
  };

  const handleSelectHistory = (analysis: CaseAnalysis) => {
    setCurrentAnalysis(analysis);
    const linked = briefings.find((b) => b.id === analysis.briefingId);
    setLinkedBriefing(linked || null);
    setActiveTab('solutions');
  };

  const handleRevealed = () => {
    if (currentAnalysis) {
      const updated = { ...currentAnalysis, solutionsRevealed: true };
      setCurrentAnalysis(updated);
      setAnalyses((prev) => prev.map((a) => a.id === updated.id ? updated : a));
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <p className="text-gray-500 dark:text-gray-400">Please sign in to use Case Interview Prep.</p>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <p className="text-gray-500 dark:text-gray-400">Please create a profile first.</p>
      </div>
    );
  }

  const hasAnalysis = currentAnalysis && currentAnalysis.status === 'ready';

  const tabs: Array<{ id: ActiveTab; label: string; disabled: boolean }> = [
    { id: 'upload', label: 'Upload Case', disabled: false },
    { id: 'practice', label: 'Practice', disabled: !hasAnalysis },
    { id: 'solutions', label: 'Solutions', disabled: !currentAnalysis },
    { id: 'history', label: 'History', disabled: false },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Case Interview Prep</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Prepare for take-home and pre-read strategic cases. Upload the case brief you received, practice presenting your strategic plan, then reveal AI-suggested approaches.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && setActiveTab(tab.id)}
            disabled={tab.disabled}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : tab.disabled
                  ? 'border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {tab.label}
            {tab.id === 'solutions' && currentAnalysis && !currentAnalysis.solutionsRevealed && (
              <span className="ml-1.5 inline-flex items-center justify-center w-2 h-2 bg-amber-400 rounded-full" title="Hidden" />
            )}
          </button>
        ))}
      </div>

      {/* Status message during analysis */}
      {isAnalyzing && statusMessage && (
        <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-400">{statusMessage}</p>
        </div>
      )}

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        {activeTab === 'upload' && (
          <CaseUpload
            briefings={briefings}
            onAnalyze={handleAnalyze}
            isAnalyzing={isAnalyzing}
          />
        )}

        {activeTab === 'practice' && hasAnalysis && (
          <MockCaseInterview
            caseAnalysis={currentAnalysis}
            briefing={linkedBriefing}
            profile={currentProfile}
            documents={documents}
          />
        )}

        {activeTab === 'solutions' && currentAnalysis && (
          <CaseAnalysisView
            analysis={currentAnalysis}
            onRevealed={handleRevealed}
            onPractice={() => setActiveTab('practice')}
          />
        )}

        {activeTab === 'history' && (
          <CaseHistory
            analyses={analyses}
            onSelect={handleSelectHistory}
            selectedId={currentAnalysis?.id || null}
          />
        )}
      </div>
    </div>
  );
}
