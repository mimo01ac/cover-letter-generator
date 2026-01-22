import { useState, useRef } from 'react';
import type { Document } from '../../types';
import { parseDocument, getFileTypeLabel } from '../../services/documentParser';
import { addDocument } from '../../services/db';

interface DocumentUploadProps {
  profileId: string;
  onDocumentAdded: (document: Document) => void;
  onDocumentsChanged?: () => void;
}

export function DocumentUpload({ profileId, onDocumentAdded, onDocumentsChanged }: DocumentUploadProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'cv' | 'experience' | 'other'>('cv');
  const [content, setContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'upload' | 'paste'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError('');

    try {
      const text = await parseDocument(file);
      setContent(text);
      if (!name) {
        setName(file.name.replace(/\.[^/.]+$/, ''));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter a document name');
      return;
    }

    if (!content.trim()) {
      setError('Please upload a file or paste content');
      return;
    }

    try {
      const id = await addDocument({
        profileId,
        name: name.trim(),
        type,
        content: content.trim(),
      });

      const newDoc: Document = {
        id,
        profileId,
        name: name.trim(),
        type,
        content: content.trim(),
        createdAt: new Date(),
      };

      onDocumentAdded(newDoc);
      setName('');
      setContent('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Trigger guide regeneration for CV and experience documents
      if ((type === 'cv' || type === 'experience') && onDocumentsChanged) {
        onDocumentsChanged();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save document');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
        Add Document
      </h3>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'upload'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }`}
        >
          Upload File
        </button>
        <button
          type="button"
          onClick={() => setMode('paste')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'paste'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }`}
        >
          Paste Text
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Document Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="My Resume"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Document Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'cv' | 'experience' | 'other')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="cv">{getFileTypeLabel('cv')}</option>
              <option value="experience">{getFileTypeLabel('experience')}</option>
              <option value="other">{getFileTypeLabel('other')}</option>
            </select>
          </div>
        </div>

        {mode === 'upload' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Upload File (.txt, .md, .pdf)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf"
              onChange={handleFileChange}
              disabled={isUploading}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white file:mr-4 file:py-1 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900 dark:file:text-blue-300"
            />
            {isUploading && (
              <p className="text-sm text-gray-500 mt-1">Parsing file...</p>
            )}
          </div>
        ) : null}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {mode === 'upload' ? 'Extracted Content (editable)' : 'Paste Content'}
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none font-mono text-sm"
            placeholder={mode === 'upload' ? 'Upload a file to extract text...' : 'Paste your CV or experience text here...'}
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={isUploading}
          className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Document
        </button>
      </form>
    </div>
  );
}
