import type { Profile, Document, CachedInterviewGuide } from '../types';
import { generateInterviewGuide } from './vapiInterview';
import {
  saveInterviewGuide,
  getInterviewGuideByProfile,
  updateInterviewGuide,
  deleteInterviewGuideByProfile,
} from './db';

// Create a hash from documents to detect changes
export function createDocumentsHash(documents: Document[]): string {
  const content = documents
    .filter(doc => doc.type === 'cv' || doc.type === 'experience')
    .sort((a, b) => (a.id || '').localeCompare(b.id || ''))
    .map(doc => `${doc.id}:${doc.name}:${doc.content.length}`)
    .join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// Check if cached guide is valid for current documents
export function isCacheValid(cache: CachedInterviewGuide | undefined, documents: Document[]): boolean {
  if (!cache) return false;
  if (cache.status !== 'ready') return false;

  const currentHash = createDocumentsHash(documents);
  return cache.documentsHash === currentHash;
}

// Get cached guide if valid
export async function getCachedGuide(
  profileId: string,
  documents: Document[]
): Promise<CachedInterviewGuide | null> {
  const cache = await getInterviewGuideByProfile(profileId);

  if (isCacheValid(cache, documents)) {
    return cache!;
  }

  return null;
}

// Get cache status for UI display
export async function getGuideStatus(
  profileId: string,
  documents: Document[]
): Promise<{ status: 'none' | 'generating' | 'ready' | 'outdated' | 'failed'; error?: string }> {
  const cache = await getInterviewGuideByProfile(profileId);

  if (!cache) {
    return { status: 'none' };
  }

  if (cache.status === 'generating') {
    return { status: 'generating' };
  }

  if (cache.status === 'failed') {
    return { status: 'failed', error: cache.error };
  }

  const currentHash = createDocumentsHash(documents);
  if (cache.documentsHash !== currentHash) {
    return { status: 'outdated' };
  }

  return { status: 'ready' };
}

// Generate and cache interview guide in background
export async function generateAndCacheGuide(
  profile: Profile,
  documents: Document[]
): Promise<void> {
  const profileId = profile.id!;
  const documentsHash = createDocumentsHash(documents);

  // Check if we already have a valid cache
  const existingCache = await getInterviewGuideByProfile(profileId);
  if (existingCache?.status === 'ready' && existingCache.documentsHash === documentsHash) {
    return; // Already have valid cache
  }

  // Check if already generating
  if (existingCache?.status === 'generating') {
    return; // Already generating
  }

  // Create placeholder entry with 'generating' status
  const cacheId = await saveInterviewGuide({
    profileId,
    guide: { introduction: '', questions: [], closing: '' },
    documentsHash,
    status: 'generating',
  });

  try {
    // Generate the guide
    const guide = await generateInterviewGuide(profile, documents);

    // Update with the result
    await updateInterviewGuide(cacheId, {
      guide,
      status: 'ready',
    });
  } catch (error) {
    // Update with error status
    await updateInterviewGuide(cacheId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Failed to generate guide',
    });
  }
}

// Invalidate cache when documents change
export async function invalidateGuideCache(profileId: string): Promise<void> {
  await deleteInterviewGuideByProfile(profileId);
}
