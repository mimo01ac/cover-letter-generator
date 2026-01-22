import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../stores/useStore';
import { refineCoverLetter } from '../../services/claude';
import { saveCoverLetter } from '../../services/db';
import type { ChatMessage } from '../../types';

interface ChatRefinementProps {
  jobDescription: string;
  jobTitle?: string;
  companyName?: string;
  onLetterUpdated: (letter: string) => void;
  initialLetter?: string;
  language?: 'en' | 'da';
}

export function ChatRefinement({ jobDescription, jobTitle, companyName, onLetterUpdated, initialLetter, language = 'en' }: ChatRefinementProps) {
  const {
    currentProfile,
    documents,
    currentLetter: storeCurrentLetter,
    setCurrentLetter,
    chatMessages,
    addChatMessage,
    isGenerating,
    setIsGenerating,
  } = useStore();

  // Use initialLetter if provided (from history), otherwise use store letter
  const currentLetter = initialLetter || storeCurrentLetter;

  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [showSaveButton, setShowSaveButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const userRequest = input.trim();
    if (!userRequest) return;

    if (!currentProfile || !currentLetter) {
      setError('No cover letter to refine. Generate one first.');
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userRequest,
      timestamp: new Date(),
    };
    addChatMessage(userMessage);
    setInput('');
    setIsGenerating(true);

    try {
      const refinedLetter = await refineCoverLetter(
        {
          currentLetter,
          conversationHistory: chatMessages,
          userRequest,
          profile: currentProfile,
          documents,
          jobDescription,
          language,
        },
        (text) => {
          setCurrentLetter(text);
          onLetterUpdated(text);
        }
      );

      setCurrentLetter(refinedLetter);
      onLetterUpdated(refinedLetter);

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'I\'ve updated the cover letter based on your feedback.',
        timestamp: new Date(),
      };
      addChatMessage(assistantMessage);
      setShowSaveButton(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refine cover letter');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveRefinedLetter = async () => {
    try {
      setSaveSuccess('');
      setError('');

      if (!currentProfile || !currentLetter) {
        setError('Cannot save. Missing profile or letter.');
        return;
      }

      await saveCoverLetter({
        profileId: currentProfile.id!,
        jobTitle: jobTitle || 'Unknown Position',
        companyName: companyName || 'Unknown Company',
        jobDescription,
        content: currentLetter,
      });

      setSaveSuccess('Updated cover letter saved successfully!');
      setShowSaveButton(false);

      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save cover letter');
    }
  };

  const suggestions = [
    'Make it more formal',
    'Emphasize my leadership experience',
    'Make it shorter',
    'Add more enthusiasm',
    'Focus on technical skills',
    'Make the opening stronger',
  ];

  if (!currentLetter) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
        Refine Your Letter
      </h3>

      {/* Chat Messages */}
      {chatMessages.length > 0 && (
        <div className="max-h-64 overflow-y-auto space-y-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-lg ${
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

      {/* Quick Suggestions */}
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => setInput(suggestion)}
            disabled={isGenerating}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe how you'd like to change the letter..."
          disabled={isGenerating}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isGenerating || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isGenerating ? (
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
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
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}

      {saveSuccess && (
        <p className="text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">{saveSuccess}</p>
      )}

      {showSaveButton && (
        <button
          onClick={handleSaveRefinedLetter}
          className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          Save Refined Version
        </button>
      )}
    </div>
  );
}
