import { useState, useRef } from 'react';
import type { Document } from '../../types';
import { parseDocument, getFileTypeLabel } from '../../services/documentParser';
import { addDocument } from '../../services/db';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  onDocumentAdded: (document: Document) => void;
  onDocumentsChanged?: () => void;
}

export function DocumentUploadModal({
  isOpen,
  onClose,
  profileId,
  onDocumentAdded,
  onDocumentsChanged,
}: DocumentUploadModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'cv' | 'experience' | 'other'>('cv');
  const [content, setContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'upload' | 'paste'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setName('');
    setType('cv');
    setContent('');
    setError('');
    setMode('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

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

      // Trigger guide regeneration for CV and experience documents
      if ((type === 'cv' || type === 'experience') && onDocumentsChanged) {
        onDocumentsChanged();
      }

      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save document');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
            Add Document
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            {mode === 'upload' && (
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
            )}

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

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Document
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
