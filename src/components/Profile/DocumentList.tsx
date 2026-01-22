import { useState } from 'react';
import type { Document } from '../../types';
import { deleteDocument } from '../../services/db';
import { getFileTypeLabel } from '../../services/documentParser';

interface DocumentListProps {
  documents: Document[];
  onDocumentDeleted: (id: string) => void;
  onDocumentsChanged?: () => void;
}

export function DocumentList({ documents, onDocumentDeleted, onDocumentsChanged }: DocumentListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    const docToDelete = documents.find(d => d.id === id);
    setDeleting(id);
    try {
      await deleteDocument(id);
      onDocumentDeleted(id);
      // Trigger guide regeneration if CV or experience document was deleted
      if (docToDelete && (docToDelete.type === 'cv' || docToDelete.type === 'experience') && onDocumentsChanged) {
        onDocumentsChanged();
      }
    } catch (err) {
      console.error('Failed to delete document:', err);
    } finally {
      setDeleting(null);
    }
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>No documents uploaded yet.</p>
        <p className="text-sm mt-1">Add your CV or experience documents above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
            onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id!)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-800 dark:text-white">
                  {doc.name}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {getFileTypeLabel(doc.type)} • {doc.content.length} characters
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(doc.id!);
                }}
                disabled={deleting === doc.id}
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting === doc.id ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                )}
              </button>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${
                  expandedId === doc.id ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>

          {expandedId === doc.id && (
            <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
              <pre className="mt-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm text-gray-700 dark:text-gray-300 overflow-auto max-h-64 whitespace-pre-wrap font-mono">
                {doc.content}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
