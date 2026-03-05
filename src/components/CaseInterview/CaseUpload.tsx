import { useState, useRef } from 'react';
import { parseDocument } from '../../services/documentParser';
import type { InterviewBriefing } from '../../types';

interface CaseUploadProps {
  briefings: InterviewBriefing[];
  onAnalyze: (title: string, caseContent: string, briefingId: string | null) => void;
  isAnalyzing: boolean;
}

export function CaseUpload({ briefings, onAnalyze, isAnalyzing }: CaseUploadProps) {
  const [title, setTitle] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [selectedBriefingId, setSelectedBriefingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    setError('');
    try {
      const text = await parseDocument(file);
      setFileContent(text);
      setFileName(file.name);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleSubmit = () => {
    const content = [fileContent, pastedText].filter(Boolean).join('\n\n---\n\n');
    if (!content.trim()) {
      setError('Please upload a file or paste case text.');
      return;
    }
    if (!title.trim()) {
      setError('Please provide a title for this case.');
      return;
    }
    onAnalyze(title.trim(), content, selectedBriefingId);
  };

  return (
    <div className="space-y-5">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Case Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Market Entry Strategy for TechCorp"
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        />
      </div>

      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Upload Case File
        </label>
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : fileName
                ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
            className="hidden"
          />
          {fileName ? (
            <div className="space-y-1">
              <svg className="w-8 h-8 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">{fileName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {fileContent.length.toLocaleString()} characters extracted
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <svg className="w-8 h-8 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Drop a file here or click to upload
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                PDF, Word (.docx), TXT, or Markdown
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Paste Text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Or Paste Case Text
        </label>
        <textarea
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          placeholder="Paste the case description here..."
          rows={6}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-y"
        />
      </div>

      {/* Briefing Link */}
      {briefings.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Link to Interview Briefing (optional)
          </label>
          <select
            value={selectedBriefingId || ''}
            onChange={(e) => setSelectedBriefingId(e.target.value || null)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            <option value="">No briefing — generic analysis</option>
            {briefings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.companyName} — {b.jobTitle}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Linking a briefing gives the AI full context about the company, role, and industry for better analysis and feedback.
          </p>
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={isAnalyzing || (!fileContent && !pastedText.trim())}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
      >
        {isAnalyzing ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            Analyzing Case...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Analyze Case
          </>
        )}
      </button>
    </div>
  );
}
