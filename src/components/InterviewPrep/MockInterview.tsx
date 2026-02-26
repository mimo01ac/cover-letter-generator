import { useState, useEffect, useRef } from 'react';
import {
  buildMockInterviewPrompt,
  startVapiCall,
  getCallStatus,
  processTranscript,
} from '../../services/vapiInterview';
import {
  getInterviewBriefing,
  saveInterview,
  updateInterview,
  getMockInterviewsByBriefing,
} from '../../services/db';
import { MockInterviewFeedbackReport } from './MockInterviewFeedbackReport';
import type { Profile, Document, InterviewResult, MockInterviewFeedback } from '../../types';

interface MockInterviewProps {
  briefingId: string | null;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  profile: Profile;
  documents: Document[];
}

type MockInterviewState = 'ready' | 'calling' | 'in-progress' | 'processing' | 'completed';

export function MockInterview({
  briefingId,
  jobTitle,
  companyName,
  jobDescription,
  profile,
  documents,
}: MockInterviewProps) {
  const [state, setState] = useState<MockInterviewState>('ready');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [, setCallId] = useState<string | null>(null);
  const [, setInterviewId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [feedback, setFeedback] = useState<MockInterviewFeedback | null>(null);
  const [pastAttempts, setPastAttempts] = useState<InterviewResult[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<InterviewResult | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load past mock interviews for this briefing
  useEffect(() => {
    if (briefingId) {
      getMockInterviewsByBriefing(briefingId)
        .then(setPastAttempts)
        .catch(() => {});
    }
  }, [briefingId, feedback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = () => {
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartCall = async () => {
    if (!briefingId) {
      setError('Please generate a briefing first before starting a mock interview.');
      return;
    }
    if (!phoneNumber.trim()) {
      setError('Please enter your phone number.');
      return;
    }

    setError('');
    setState('calling');

    try {
      // Fetch the full briefing to build the recruiter prompt
      const briefing = await getInterviewBriefing(briefingId);
      if (!briefing) {
        throw new Error('Briefing not found');
      }

      // Get CV content from documents
      const cvDoc = documents.find((d) => d.type === 'cv');
      const cvContent = cvDoc?.content;

      const prompt = buildMockInterviewPrompt(
        profile.name,
        companyName,
        jobTitle,
        briefing,
        cvContent
      );

      const newCallId = await startVapiCall(phoneNumber, prompt, profile.name, {
        mode: 'mock-interview',
        companyName,
        jobTitle,
      });

      setCallId(newCallId);

      // Save interview record
      const id = await saveInterview({
        profileId: profile.id!,
        callId: newCallId,
        phoneNumber,
        status: 'pending',
        mode: 'mock-interview',
        briefingId,
        jobTitle,
        companyName,
      });
      setInterviewId(id);

      setState('in-progress');
      startTimer();

      // Start polling for call completion
      pollRef.current = setInterval(async () => {
        try {
          const status = await getCallStatus(newCallId);

          if (status.status === 'ended' || status.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
            stopTimer();

            if (status.transcript) {
              setState('processing');

              // Process transcript for feedback
              const result = await processTranscript(
                status.transcript,
                profile.name,
                {
                  mode: 'mock-interview',
                  jobTitle,
                  companyName,
                  jobDescription,
                }
              );

              if (result.feedback) {
                setFeedback(result.feedback);
                await updateInterview(id, {
                  status: 'completed',
                  transcript: status.transcript,
                  feedback: result.feedback,
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
    setSelectedAttempt(null);
    setElapsedSeconds(0);
    setError('');
  };

  const handleViewAttempt = (attempt: InterviewResult) => {
    setSelectedAttempt(attempt);
    setFeedback(attempt.feedback || null);
    setState('completed');
  };

  // Show past attempt feedback
  if (selectedAttempt && feedback) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              Mock Interview Results
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(selectedAttempt.createdAt).toLocaleDateString()} — {companyName} / {jobTitle}
            </p>
          </div>
          <button
            onClick={handleTryAgain}
            className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            New Attempt
          </button>
        </div>
        <MockInterviewFeedbackReport feedback={feedback} />
      </div>
    );
  }

  // No briefing yet
  if (!briefingId) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
          Generate a Briefing First
        </h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          A briefing pack provides the company research, interview questions, and context needed to create a realistic mock interview. Generate one using the form on the left.
        </p>
      </div>
    );
  }

  // Ready state
  if (state === 'ready') {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
            Mock Phone Screen
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            An AI recruiter from {companyName} will call you and conduct a realistic phone screen for the {jobTitle} position.
          </p>
        </div>

        {/* What to expect */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">What to expect</h4>
          <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-400">
            <li className="flex items-start gap-2">
              <span className="shrink-0 mt-1">1.</span>
              You'll receive a phone call from "Alex" at {companyName}
            </li>
            <li className="flex items-start gap-2">
              <span className="shrink-0 mt-1">2.</span>
              The interview covers role-specific, behavioral, and cultural fit questions (~20 min)
            </li>
            <li className="flex items-start gap-2">
              <span className="shrink-0 mt-1">3.</span>
              After the call, you'll get a detailed performance report with scores and actionable feedback
            </li>
          </ul>
        </div>

        {/* Phone input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Phone Number
          </label>
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
          Start Mock Interview
        </button>

        {/* Past Attempts */}
        {pastAttempts.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Previous Attempts
            </h4>
            <div className="space-y-2">
              {pastAttempts.map((attempt) => (
                <button
                  key={attempt.id}
                  onClick={() => handleViewAttempt(attempt)}
                  className="w-full text-left px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-800 dark:text-white">
                      {new Date(attempt.createdAt).toLocaleDateString()} at{' '}
                      {new Date(attempt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

  // Calling / In Progress state
  if (state === 'calling' || state === 'in-progress') {
    return (
      <div className="p-8 text-center space-y-6">
        {/* Animated call indicator */}
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
            {state === 'calling' ? 'Connecting...' : 'Interview in Progress'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {state === 'calling'
              ? `Calling your phone as Alex from ${companyName}...`
              : `You're speaking with Alex from ${companyName}`}
          </p>
          {state === 'in-progress' && (
            <p className="text-2xl font-mono text-gray-800 dark:text-white mt-4">
              {formatTime(elapsedSeconds)}
            </p>
          )}
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500">
          The call will be transcribed and analyzed after it ends. Just talk naturally!
        </p>
      </div>
    );
  }

  // Processing state
  if (state === 'processing') {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            Analyzing Your Performance
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Generating detailed feedback on your interview...
          </p>
        </div>
      </div>
    );
  }

  // Completed state
  if (state === 'completed' && feedback) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            Interview Results
          </h3>
          <button
            onClick={handleTryAgain}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
        <MockInterviewFeedbackReport feedback={feedback} />
      </div>
    );
  }

  return null;
}
