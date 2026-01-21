import { useState, useEffect, useCallback } from 'react';
import { ProfileForm } from './ProfileForm';
import { DocumentUpload } from './DocumentUpload';
import { DocumentList } from './DocumentList';
import { InterviewModal } from './InterviewModal';
import { useStore } from '../../stores/useStore';
import { getAllProfiles, getDocumentsByProfile } from '../../services/db';
import { generateAndCacheGuide, getGuideStatus } from '../../services/interviewGuideCache';
import type { Profile, Document } from '../../types';

export function ProfilePage() {
  const { currentProfile, setCurrentProfile, setProfiles, profiles, documents, setDocuments } = useStore();
  const [loading, setLoading] = useState(true);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [guideStatus, setGuideStatus] = useState<'none' | 'generating' | 'ready' | 'outdated' | 'failed'>('none');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (currentProfile?.id) {
      loadDocuments(currentProfile.id);
    }
  }, [currentProfile?.id]);

  // Check and update guide status when documents change
  useEffect(() => {
    if (currentProfile?.id && documents.length > 0) {
      checkGuideStatus();
    }
  }, [currentProfile?.id, documents]);

  const checkGuideStatus = async () => {
    if (!currentProfile?.id) return;
    const status = await getGuideStatus(currentProfile.id, documents);
    setGuideStatus(status.status);
  };

  const handleDocumentsChanged = useCallback(async () => {
    if (!currentProfile?.id) return;

    // Trigger guide generation in background
    try {
      // Need to wait for documents state to update, use a small delay
      setTimeout(async () => {
        const updatedDocs = await getDocumentsByProfile(currentProfile.id!);
        const relevantDocs = updatedDocs.filter(d => d.type === 'cv' || d.type === 'experience');
        if (relevantDocs.length > 0) {
          setGuideStatus('generating');
          await generateAndCacheGuide(currentProfile, updatedDocs);
          checkGuideStatus();
        }
      }, 100);
    } catch (err) {
      console.error('Failed to generate interview guide:', err);
    }
  }, [currentProfile]);

  const loadData = async () => {
    try {
      const allProfiles = await getAllProfiles();
      setProfiles(allProfiles);
      if (allProfiles.length > 0 && !currentProfile) {
        setCurrentProfile(allProfiles[0]);
      }
    } catch (err) {
      console.error('Failed to load profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async (profileId: string) => {
    try {
      const docs = await getDocumentsByProfile(profileId);
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  const handleProfileSaved = (profile: Profile) => {
    if (!profiles.find((p) => p.id === profile.id)) {
      setProfiles([...profiles, profile]);
    } else {
      setProfiles(profiles.map((p) => (p.id === profile.id ? profile : p)));
    }
  };

  const handleDocumentAdded = (doc: Document) => {
    setDocuments([...documents, doc]);
  };

  const handleDocumentDeleted = (id: string) => {
    setDocuments(documents.filter((d) => d.id !== id));
  };

  const handleProfileSwitch = (profile: Profile) => {
    setCurrentProfile(profile);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Profile Management
        </h1>
        {profiles.length > 1 && (
          <select
            value={currentProfile?.id || ''}
            onChange={(e) => {
              const profile = profiles.find((p) => p.id === e.target.value);
              if (profile) handleProfileSwitch(profile);
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {currentProfile ? 'Edit Profile' : 'Create Profile'}
          </h2>
          <ProfileForm profile={currentProfile} onSave={handleProfileSaved} />
        </div>

        <div className="space-y-6">
          {currentProfile?.id && (
            <>
              <DocumentUpload
                profileId={currentProfile.id}
                onDocumentAdded={handleDocumentAdded}
                onDocumentsChanged={handleDocumentsChanged}
              />

              {/* AI Interview Section */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-purple-100 dark:bg-purple-800 p-3 rounded-lg">
                    <svg className="w-6 h-6 text-purple-600 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      AI Career Interview
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                      Get a phone call from our AI to discuss your experience in depth.
                      The insights will help create more personalized cover letters.
                    </p>

                    {/* Guide status */}
                    {guideStatus === 'ready' && (
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs mb-3">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Interview guide ready
                      </div>
                    )}
                    {guideStatus === 'generating' && (
                      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs mb-3">
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Preparing interview guide...
                      </div>
                    )}

                    <button
                      onClick={() => setShowInterviewModal(true)}
                      className="bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0" />
                      </svg>
                      Start Interview
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Your Documents ({documents.length})
                </h3>
                <DocumentList
                  documents={documents}
                  onDocumentDeleted={handleDocumentDeleted}
                  onDocumentsChanged={handleDocumentsChanged}
                />
              </div>
            </>
          )}

          {!currentProfile && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Get Started
              </h3>
              <p className="text-blue-700 dark:text-blue-300">
                Create a profile first, then you can upload your CV and other documents to use when generating cover letters.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Interview Modal */}
      {currentProfile && (
        <InterviewModal
          isOpen={showInterviewModal}
          onClose={() => setShowInterviewModal(false)}
          profile={currentProfile}
          documents={documents}
          onInterviewComplete={() => {
            // Reload documents to show the new interview insights
            if (currentProfile.id) {
              loadDocuments(currentProfile.id);
            }
          }}
        />
      )}
    </div>
  );
}
