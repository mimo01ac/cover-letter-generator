import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../stores/useStore';
import { refineTailoredCV } from '../../services/cvTailor';
import type { ChatMessage, TailoredCVData } from '../../types';

interface CVRefinementProps {
  cvId: string;
  cvData: TailoredCVData;
  jobDescription: string;
  language: string;
  onCVUpdated: (data: TailoredCVData) => void;
}

export function CVRefinement({ cvId, cvData, jobDescription, language, onCVUpdated }: CVRefinementProps) {
  const { currentProfile, documents } = useStore();

  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const userRequest = input.trim();
    if (!userRequest || !currentProfile) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userRequest,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsRefining(true);

    try {
      const updatedData = await refineTailoredCV(
        cvId,
        cvData,
        userRequest,
        messages,
        currentProfile,
        documents,
        jobDescription,
        language,
        (data) => onCVUpdated(data)
      );

      onCVUpdated(updatedData);

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'I\'ve updated the CV based on your feedback.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refine CV');
    } finally {
      setIsRefining(false);
    }
  };

  const quickActions = [
    { label: 'Stronger bullets', prompt: 'Make the experience bullet points more impactful with stronger action verbs' },
    { label: 'More keywords', prompt: 'Add more relevant keywords from the job description to the skills and bullet points' },
    { label: 'Shorter summary', prompt: 'Make the executive summary more concise' },
    { label: 'Reorder experience', prompt: 'Reorder the experience entries to put the most relevant ones first' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
        Refine Your CV
      </h3>

      {/* Chat Messages */}
      {messages.length > 0 && (
        <div className="max-h-32 overflow-y-auto space-y-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3 py-1.5 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
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
            disabled={isRefining}
            className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe changes..."
          disabled={isRefining}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isRefining || !input.trim()}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRefining ? (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </form>

      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}
