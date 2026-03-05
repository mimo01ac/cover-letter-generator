import { useState, useEffect, useRef } from 'react';
import {
  startVapiCall,
  getCallStatus,
  processTranscript,
} from '../../services/vapiInterview';
import { saveInterview, updateInterview } from '../../services/db';
import { getCaseInterviewsByAnalysis } from '../../services/caseInterview';
import { CaseInterviewFeedbackReport } from './CaseInterviewFeedbackReport';
import type { Profile, Document, CaseAnalysis, CaseInterviewFeedback, InterviewBriefing } from '../../types';

interface MockCaseInterviewProps {
  caseAnalysis: CaseAnalysis;
  briefing: InterviewBriefing | null;
  profile: Profile;
  documents: Document[];
}

type CallState = 'ready' | 'calling' | 'in-progress' | 'processing' | 'completed';

export function MockCaseInterview({ caseAnalysis, briefing, profile, documents }: MockCaseInterviewProps) {
  const [state, setState] = useState<CallState>('ready');
  const [phoneNumber, setPhoneNumber] = useState(profile.phone || '');
  const [error, setError] = useState('');
  const [, setCallId] = useState<string | null>(null);
  const [, setInterviewId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [feedback, setFeedback] = useState<CaseInterviewFeedback | null>(null);
  const [pastAttempts, setPastAttempts] = useState<Array<{ id: string; feedback: CaseInterviewFeedback | null; createdAt: Date }>>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (caseAnalysis.id) {
      getCaseInterviewsByAnalysis(caseAnalysis.id)
        .then(setPastAttempts)
        .catch(() => {});
    }
  }, [caseAnalysis.id, feedback]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = () => {
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => setElapsedSeconds((p) => p + 1), 1000);
  };
  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const buildCaseInterviewPrompt = (): string => {
    const companyContext = briefing ? `
## Company & Role Context (use for industry-specific follow-ups)
- Company: ${briefing.companyName}
- Role: ${briefing.jobTitle}
- Job Description: ${briefing.jobDescription}
- Company Research: ${briefing.companyResearch ? JSON.stringify(briefing.companyResearch) : 'N/A'}
- Industry Analysis: ${briefing.industryAnalysis ? JSON.stringify(briefing.industryAnalysis) : 'N/A'}` : '';

    const cvDoc = documents.find((d) => d.type === 'cv');
    const cvSection = cvDoc ? `
## Candidate CV (for reference — do NOT reveal you have this)
${cvDoc.content}` : '';

    return `You are Sarah, an executive interviewer and hiring panel member for a senior leadership position. You are evaluating how the candidate presents their strategic plan for a pre-read case brief they received in advance.

## Context
This is NOT a live case-cracking exercise or back-of-envelope estimation. The candidate received a strategic case brief beforehand and has had time to prepare. They are now presenting their strategic approach — similar to how a new CCO, VP, or Director would present their first 90-day plan or turnaround strategy to the board.

## Your Personality
- Senior, experienced executive — you've seen hundreds of strategic plans
- You challenge assumptions: "What makes you confident that will work?" "What if the board pushes back?"
- You probe for depth behind high-level statements: "Walk me through the execution specifics"
- You test prioritization: "If you could only do two of these, which two and why?"
- You evaluate leadership thinking: strategic clarity, stakeholder awareness, risk management
- You are respectful but direct — this is a senior-level evaluation
${companyContext}
${cvSection}

## The Case Brief (candidate received this in advance)
${caseAnalysis.caseContent}

## Interview Flow
1. **Opening** (1 min): Introduce yourself, confirm they've reviewed the case, ask them to present their approach
2. **Presentation** (5-7 min): Let them walk through their strategic plan uninterrupted, take notes
3. **Challenge Round** (8-10 min): Ask 3-4 probing questions — challenge their priorities, assumptions, timeline, stakeholder management, and risk mitigation
4. **Curveball** (2-3 min): Introduce a new constraint or stakeholder concern (e.g., "The CEO just told you the budget is being cut 30%" or "A key competitor just made a major move")
5. **Synthesis** (2-3 min): Ask them to summarize their revised recommendation in 60 seconds — as if presenting to the board
6. **Close** (1 min): Thank them professionally

## Important Guidelines
- Stay in character as Sarah at ALL times
- Do NOT provide coaching or feedback during the call
- Let them present first — don't interrupt the initial presentation
- After their presentation, probe on strategic thinking, not frameworks or math
- Focus on: prioritization, stakeholder management, execution realism, risk awareness, leadership presence
- If they use generic consulting jargon without substance, push: "What does that actually mean in practice?"
- Keep to ~20 minutes total
- End professionally with: "Thank you for your time. We'll follow up with detailed feedback."`;
  };

  const handleStartCall = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter your phone number.');
      return;
    }
    setError('');
    setState('calling');

    try {
      const prompt = buildCaseInterviewPrompt();
      const companyName = briefing?.companyName || 'Consulting Firm';
      const jobTitle = briefing?.jobTitle || 'Case Interview';

      const newCallId = await startVapiCall(phoneNumber, prompt, profile.name, {
        mode: 'case-interview',
        companyName,
        jobTitle,
      });
      setCallId(newCallId);

      const id = await saveInterview({
        profileId: profile.id!,
        callId: newCallId,
        phoneNumber,
        status: 'pending',
        mode: 'case-interview',
        briefingId: caseAnalysis.id,
        jobTitle,
        companyName,
      });
      setInterviewId(id);

      setState('in-progress');
      startTimer();

      pollRef.current = setInterval(async () => {
        try {
          const status = await getCallStatus(newCallId);
          if (status.status === 'ended' || status.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
            stopTimer();

            if (status.transcript) {
              setState('processing');
              const result = await processTranscript(
                status.transcript,
                profile.name,
                {
                  mode: 'case-interview',
                  jobTitle,
                  companyName,
                  jobDescription: caseAnalysis.caseContent,
                }
              );
              if (result.feedback) {
                const caseFeedback = result.feedback as unknown as CaseInterviewFeedback;
                setFeedback(caseFeedback);
                await updateInterview(id, {
                  status: 'completed',
                  transcript: status.transcript,
                  feedback: result.feedback as unknown as import('../../types').MockInterviewFeedback,
                  completedAt: new Date(),
                });
              }
              setState('completed');
            } else {
              setError('Call ended without a transcript. Please try again.');
              await updateInterview(id, { status: 'failed' });
              setState('ready');
            }
          }
        } catch (pollError) {
          console.error('Poll error:', pollError);
        }
      }, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start call');
      setState('ready');
    }
  };

  const handleTryAgain = () => {
    setState('ready');
    setCallId(null);
    setInterviewId(null);
    setFeedback(null);
    setSelectedAttemptId(null);
    setElapsedSeconds(0);
    setError('');
  };

  const handleViewAttempt = (attempt: { id: string; feedback: CaseInterviewFeedback | null }) => {
    if (attempt.feedback) {
      setSelectedAttemptId(attempt.id);
      setFeedback(attempt.feedback);
      setState('completed');
    }
  };

  // Viewing a past attempt
  if (selectedAttemptId && feedback) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Case Interview Results</h3>
          <button onClick={handleTryAgain} className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
            New Attempt
          </button>
        </div>
        <CaseInterviewFeedbackReport feedback={feedback} />
      </div>
    );
  }

  // Ready state
  if (state === 'ready') {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">Mock Case Presentation</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Present your strategic plan for the pre-read case. Sarah, an executive interviewer, will evaluate your approach and challenge your thinking.
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">What to expect</h4>
          <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-400">
            <li className="flex items-start gap-2"><span className="shrink-0 mt-1">1.</span>Present your strategic approach to the case brief (~5-7 min)</li>
            <li className="flex items-start gap-2"><span className="shrink-0 mt-1">2.</span>Sarah will challenge your priorities, assumptions, and execution plan</li>
            <li className="flex items-start gap-2"><span className="shrink-0 mt-1">3.</span>A curveball — new constraint or stakeholder concern — to test adaptability</li>
            <li className="flex items-start gap-2"><span className="shrink-0 mt-1">4.</span>60-second board-level synthesis of your revised recommendation</li>
            <li className="flex items-start gap-2"><span className="shrink-0 mt-1">5.</span>Detailed feedback on strategic clarity, prioritization, leadership & communication</li>
          </ul>
        </div>

        {!caseAnalysis.solutionsRevealed && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <p className="text-sm text-green-700 dark:text-green-400">
              Solutions are still hidden — great choice practicing your own approach first!
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1 (555) 123-4567"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleStartCall}
          className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          Start Case Interview
        </button>

        {pastAttempts.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Previous Attempts</h4>
            <div className="space-y-2">
              {pastAttempts.map((attempt) => (
                <button
                  key={attempt.id}
                  onClick={() => handleViewAttempt(attempt)}
                  className="w-full text-left px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-800 dark:text-white">
                      {attempt.createdAt.toLocaleDateString()} at {attempt.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {attempt.feedback && (
                      <span className={`text-sm font-bold ${
                        attempt.feedback.overallScore >= 8 ? 'text-green-600 dark:text-green-400' :
                        attempt.feedback.overallScore >= 6 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {attempt.feedback.overallScore}/10
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Calling / In Progress
  if (state === 'calling' || state === 'in-progress') {
    return (
      <div className="p-8 text-center space-y-6">
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute w-24 h-24 bg-green-500/20 rounded-full animate-ping" />
          <div className="absolute w-20 h-20 bg-green-500/30 rounded-full animate-pulse" />
          <div className="relative w-16 h-16 bg-green-600 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            {state === 'calling' ? 'Connecting...' : 'Case Interview in Progress'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {state === 'calling' ? 'Calling you as Sarah...' : 'You\'re speaking with Sarah'}
          </p>
          {state === 'in-progress' && (
            <p className="text-2xl font-mono text-gray-800 dark:text-white mt-4">{formatTime(elapsedSeconds)}</p>
          )}
        </div>
      </div>
    );
  }

  // Processing
  if (state === 'processing') {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Analyzing Your Case Performance</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Generating structured feedback on structuring, quant, communication & synthesis...</p>
        </div>
      </div>
    );
  }

  // Completed
  if (state === 'completed' && feedback) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Case Interview Results</h3>
          <button onClick={handleTryAgain} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Try Again
          </button>
        </div>
        <CaseInterviewFeedbackReport feedback={feedback} />
      </div>
    );
  }

  return null;
}
