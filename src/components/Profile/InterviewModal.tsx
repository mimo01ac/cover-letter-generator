import { useState, useEffect, useRef } from 'react';
import {
  generateInterviewGuide,
  buildVapiPrompt,
  startVapiCall,
  getCallStatus,
  processTranscript,
} from '../../services/vapiInterview';
import {
  saveInterview,
  updateInterview,
  addDocument,
} from '../../services/db';
import {
  getCachedGuide,
  getGuideStatus,
} from '../../services/interviewGuideCache';
import type { Profile, Document, CachedInterviewGuide } from '../../types';

interface InterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile;
  documents: Document[];
  onInterviewComplete: () => void;
}

type InterviewStep =
  | 'input'
  | 'generating-guide'
  | 'starting-call'
  | 'in-progress'
  | 'processing'
  | 'completed'
  | 'error';

export function InterviewModal({
  isOpen,
  onClose,
  profile,
  documents,
  onInterviewComplete,
}: InterviewModalProps) {
  const [phoneNumber, setPhoneNumber] = useState(profile.phone || '');
  const [step, setStep] = useState<InterviewStep>('input');
  const [error, setError] = useState('');
  const [_callId, setCallId] = useState<string | null>(null);
  const [_interviewId, setInterviewId] = useState<string | null>(null);
  const [guideStatus, setGuideStatus] = useState<'none' | 'generating' | 'ready' | 'outdated' | 'failed'>('none');
  const [cachedGuide, setCachedGuide] = useState<CachedInterviewGuide | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  // Check guide status when modal opens
  useEffect(() => {
    if (isOpen && profile?.id) {
      checkGuideStatus();
    }
  }, [isOpen, profile?.id, documents]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const checkGuideStatus = async () => {
    if (!profile?.id) return;
    const status = await getGuideStatus(profile.id, documents);
    setGuideStatus(status.status);
    if (status.status === 'ready') {
      const guide = await getCachedGuide(profile.id, documents);
      setCachedGuide(guide);
    }
  };

  const handleStartInterview = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    setError('');

    try {
      let guide;

      // Use cached guide if available, otherwise generate
      if (cachedGuide && guideStatus === 'ready') {
        guide = cachedGuide.guide;
        setStep('starting-call');
      } else {
        setStep('generating-guide');
        guide = await generateInterviewGuide(profile, documents);
      }

      const prompt = buildVapiPrompt(profile, guide);

      // Start the call
      if (step !== 'starting-call') {
        setStep('starting-call');
      }
      const newCallId = await startVapiCall(phoneNumber.trim(), prompt, profile.name);
      setCallId(newCallId);

      // Save to database
      const id = await saveInterview({
        profileId: profile.id!,
        callId: newCallId,
        phoneNumber: phoneNumber.trim(),
        status: 'pending',
      });
      setInterviewId(id);

      // Start polling for call status
      setStep('in-progress');
      startPolling(newCallId, id);
    } catch (err) {
      console.error('Failed to start interview:', err);
      setError(err instanceof Error ? err.message : 'Failed to start interview');
      setStep('error');
    }
  };

  const startPolling = (callId: string, interviewDbId: string) => {
    pollIntervalRef.current = window.setInterval(async () => {
      try {
        const status = await getCallStatus(callId);

        if (status.status === 'ended' || status.status === 'failed') {
          // Stop polling
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          if (status.status === 'failed') {
            setStep('error');
            setError(`Call failed: ${status.endedReason || 'Unknown reason'}`);
            await updateInterview(interviewDbId, { status: 'failed' });
            return;
          }

          // Process transcript
          setStep('processing');

          if (status.transcript) {
            const { summary, insights } = await processTranscript(
              status.transcript,
              profile.name
            );

            // Update interview record
            await updateInterview(interviewDbId, {
              status: 'completed',
              transcript: status.transcript,
              summary,
              insights,
              completedAt: new Date(),
            });

            // Save insights as a document
            await addDocument({
              profileId: profile.id!,
              name: `Interview Insights - ${new Date().toLocaleDateString()}`,
              type: 'experience',
              content: insights,
            });

            setStep('completed');
            onInterviewComplete();
          } else {
            setStep('error');
            setError('No transcript available from the call');
          }
        } else if (status.status === 'in-progress') {
          await updateInterview(interviewDbId, { status: 'in-progress' });
        }
      } catch (err) {
        console.error('Error polling call status:', err);
      }
    }, 5000); // Poll every 5 seconds
  };

  const handleClose = () => {
    if (step === 'in-progress') {
      if (!confirm('The interview is still in progress. Are you sure you want to close?')) {
        return;
      }
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    setStep('input');
    setPhoneNumber('');
    setError('');
    setCallId(null);
    setInterviewId(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
            AI Career Interview
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === 'input' && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Our AI will call you and conduct a 15-20 minute interview about your professional experience.
              The insights gathered will help create more personalized cover letters.
            </p>

            {/* Guide status indicator */}
            {guideStatus === 'ready' && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Interview guide ready - call will start immediately
              </div>
            )}
            {guideStatus === 'generating' && (
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Preparing interview guide...
              </div>
            )}
            {(guideStatus === 'none' || guideStatus === 'outdated') && documents.filter(d => d.type === 'cv' || d.type === 'experience').length > 0 && (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Interview guide will be prepared when you start
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+45 12 34 56 78"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Include country code (e.g., +45 for Denmark, +1 for US)
              </p>
            </div>

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">What to expect:</h4>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• You'll receive a call within 30 seconds</li>
                <li>• The AI will ask about your career journey and achievements</li>
                <li>• Share specific examples and metrics when possible</li>
                <li>• The call takes 15-20 minutes</li>
              </ul>
            </div>

            <button
              onClick={handleStartInterview}
              disabled={!phoneNumber.trim() || guideStatus === 'generating'}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Start Interview Call
            </button>
          </div>
        )}

        {step === 'generating-guide' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Analyzing your CV and preparing interview questions...
            </p>
          </div>
        )}

        {step === 'starting-call' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Initiating call to {phoneNumber}...
            </p>
          </div>
        )}

        {step === 'in-progress' && (
          <div className="text-center py-8">
            <div className="relative">
              <div className="animate-pulse">
                <svg className="w-16 h-16 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
            </div>
            <p className="text-lg font-medium text-gray-800 dark:text-white mt-4">
              Interview in Progress
            </p>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Please answer the call and share your experiences.
              <br />
              This window will update automatically when the call ends.
            </p>
          </div>
        )}

        {step === 'processing' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Processing interview transcript and extracting insights...
            </p>
          </div>
        )}

        {step === 'completed' && (
          <div className="text-center py-8">
            <svg className="w-16 h-16 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg font-medium text-gray-800 dark:text-white">
              Interview Complete!
            </p>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              The insights from your interview have been saved and will be used
              to create more personalized cover letters.
            </p>
            <button
              onClick={handleClose}
              className="mt-4 bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center py-8">
            <svg className="w-16 h-16 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg font-medium text-gray-800 dark:text-white">
              Something went wrong
            </p>
            <p className="text-red-500 mt-2">{error}</p>
            <button
              onClick={() => {
                setStep('input');
                setError('');
              }}
              className="mt-4 bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
