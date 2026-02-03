import { useState } from 'react';
import type { ReactNode } from 'react';

interface BriefingDocumentProps {
  content: string;
  briefingId: string | null;
  isGenerating?: boolean;
}

// Simple markdown-like rendering without external dependency
function renderMarkdown(text: string): ReactNode[] {
  const lines = text.split('\n');
  const elements: ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key++} className="text-xl font-semibold text-gray-800 dark:text-white mt-6 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={key++} className="text-lg font-medium text-gray-700 dark:text-gray-200 mt-4 mb-2">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <h1 key={key++} className="text-2xl font-bold text-gray-800 dark:text-white mt-6 mb-4">
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <li key={key++} className="text-gray-600 dark:text-gray-300 ml-4 list-disc">
          {renderInlineFormatting(line.slice(2))}
        </li>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^\d+\.\s(.*)$/);
      if (match) {
        elements.push(
          <li key={key++} className="text-gray-600 dark:text-gray-300 ml-4 list-decimal">
            {renderInlineFormatting(match[1])}
          </li>
        );
      }
    } else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-2" />);
    } else {
      elements.push(
        <p key={key++} className="text-gray-600 dark:text-gray-300 mb-2 leading-relaxed">
          {renderInlineFormatting(line)}
        </p>
      );
    }
  }

  return elements;
}

function renderInlineFormatting(text: string): React.ReactNode {
  // Handle **bold** text
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-gray-800 dark:text-white">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export function BriefingDocument({ content, briefingId: _briefingId, isGenerating }: BriefingDocumentProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-briefing-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!content && !isGenerating) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        <p>Your briefing document will appear here once generated.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Actions */}
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <button
          onClick={handleCopy}
          disabled={!content}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          title="Copy to clipboard"
        >
          {copied ? (
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
        <button
          onClick={handleDownload}
          disabled={!content}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          title="Download as markdown"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        {isGenerating && !content && (
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Generating briefing document...</span>
          </div>
        )}
        {content && renderMarkdown(content)}
        {isGenerating && content && (
          <span className="inline-block w-2 h-5 bg-blue-500 animate-pulse ml-1" />
        )}
      </div>
    </div>
  );
}
