import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../stores/useStore';
import { refineSummary } from '../../services/claude';
import type { ChatMessage } from '../../types';

interface SummaryRefinementProps {
  jobDescription: string;
  jobTitle: string;
  onSummaryUpdated: (summary: string) => void;
  initialSummary?: string;
  language?: 'en' | 'da';
}

export function SummaryRefinement({
  jobDescription,
  jobTitle,
  onSummaryUpdated,
  initialSummary,
  language = 'en',
}: SummaryRefinementProps) {
  const {
    currentProfile,
    documents,
    currentSummary: storeCurrentSummary,
    setCurrentSummary,
    summaryChatMessages,
    addSummaryChatMessage,
    isGeneratingSummary,
    setIsGeneratingSummary,
  } = useStore();

  // Use initialSummary if provided (from history), otherwise use store summary
  const currentSummary = initialSummary || storeCurrentSummary;

  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [summaryChatMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const userRequest = input.trim();
    if (!userRequest) return;

    if (!currentProfile || !currentSummary) {
      setError('No executive summary to refine.');
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userRequest,
      timestamp: new Date(),
    };
    addSummaryChatMessage(userMessage);
    setInput('');
    setIsGeneratingSummary(true);

    try {
      const refinedSummary = await refineSummary(
        {
          currentSummary,
          conversationHistory: summaryChatMessages,
          userRequest,
          profile: currentProfile,
          documents,
          jobTitle,
          jobDescription,
          language,
        },
        (text) => {
          setCurrentSummary(text);
          onSummaryUpdated(text);
        }
      );

      setCurrentSummary(refinedSummary);
      onSummaryUpdated(refinedSummary);

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "I've updated the executive summary based on your feedback.",
        timestamp: new Date(),
      };
      addSummaryChatMessage(assistantMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refine summary');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const quickActions = [
    { label: 'More specific', prompt: 'Make it more specific to the role' },
    { label: 'Add metrics', prompt: 'Include more quantifiable achievements' },
    { label: 'Shorter', prompt: 'Make it shorter and more concise' },
    { label: 'Leadership focus', prompt: 'Emphasize leadership experience' },
  ];

  if (!currentSummary) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
        Refine Your Summary
      </h3>

      {/* Chat Messages - Compact */}
      {summaryChatMessages.length > 0 && (
        <div className="max-h-32 overflow-y-auto space-y-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm">
          {summaryChatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3 py-1.5 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Quick Action Pills */}
      <div className="flex flex-wrap gap-1.5">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => setInput(action.prompt)}
            disabled={isGeneratingSummary}
            className="px-2.5 py-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Input Form - Compact */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe changes..."
          disabled={isGeneratingSummary}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isGeneratingSummary || !input.trim()}
          className="px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGeneratingSummary ? (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </form>

      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}
