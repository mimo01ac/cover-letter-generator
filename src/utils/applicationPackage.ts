import { get, set, del } from 'idb-keyval';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { generateCoverLetterDocxBlob, generateTailoredCVDocxBlob, sanitize } from './wordExport';
import { generateCVPDF, generateCoverLetterPDF } from './pdfExport';
import type { TailoredCVData, CVTemplate, Profile, CoverLetter } from '../types';

const DIR_HANDLE_KEY = 'application-package-dir-handle';

export interface SavePackageParams {
  cvData: TailoredCVData;
  profile: Profile;
  template: CVTemplate;
  jobTitle: string;
  companyName: string;
  coverLetter?: CoverLetter;
  cvPreviewElement: HTMLElement;
}

export type ProgressCallback = (step: string, progress: number) => void;

export function hasFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function getBaseFolderName(): Promise<string | null> {
  if (!hasFileSystemAccess()) return null;
  try {
    const handle = await get<FileSystemDirectoryHandle>(DIR_HANDLE_KEY);
    return handle?.name ?? null;
  } catch {
    return null;
  }
}

/**
 * Show the native directory picker so the user can choose a new base folder.
 * Returns the folder name on success, null if the user cancelled.
 * Throws on unexpected errors.
 */
export async function changeBaseFolder(): Promise<string | null> {
  if (!hasFileSystemAccess()) throw new Error('File System Access API not available');
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await set(DIR_HANDLE_KEY, handle);
    return handle.name;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    throw err;
  }
}

/**
 * Delete the stored directory handle from IndexedDB.
 * Next save will either prompt for a folder or fall back to ZIP.
 */
export async function clearBaseFolder(): Promise<void> {
  await del(DIR_HANDLE_KEY);
}

/**
 * Call this immediately in a click handler to acquire a writable directory handle.
 * Must be called while user-gesture context is still active.
 * Returns the handle or undefined (user cancelled / not available).
 * Throws on real errors.
 */
export async function acquireDirectoryHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  if (!hasFileSystemAccess()) {
    console.log('[AcquireDir] File System Access API not available');
    return undefined;
  }

  const handle = await get<FileSystemDirectoryHandle>(DIR_HANDLE_KEY);
  console.log('[AcquireDir] Stored handle:', handle ? handle.name : 'none');

  if (handle) {
    try {
      const perm = await handle.requestPermission({ mode: 'readwrite' });
      console.log('[AcquireDir] Permission result:', perm);
      if (perm === 'granted') {
        try {
          const testName = `.___probe_${Date.now()}`;
          const testDir = await handle.getDirectoryHandle(testName, { create: true });
          if (testDir) await handle.removeEntry(testName);
          console.log('[AcquireDir] Probe succeeded, returning stored handle:', handle.name);
          return handle;
        } catch (e) {
          console.warn('[AcquireDir] Probe failed:', e);
        }
      }
    } catch (e) {
      console.warn('[AcquireDir] requestPermission threw:', e);
    }
  }

  // No stored handle, permission denied, or handle broken — show picker
  try {
    console.log('[AcquireDir] Showing directory picker...');
    const freshHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await set(DIR_HANDLE_KEY, freshHandle);
    console.log('[AcquireDir] Fresh handle acquired:', freshHandle.name);
    return freshHandle;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.log('[AcquireDir] User cancelled picker');
      return undefined;
    }
    throw err;
  }
}

function buildFolderName(companyName: string, jobTitle: string): string {
  const raw = `${companyName} - ${jobTitle}`;
  return raw.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim();
}

/**
 * Returns true if the folder name looks like a cloud-synced directory
 * (Google Drive, iCloud, Dropbox, OneDrive). These often silently break
 * File System Access API writes.
 */
export function isCloudFolder(name: string): boolean {
  return /google\s*drive|my\s*drive|icloud|dropbox|onedrive/i.test(name);
}

async function writeFileToDirectory(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
  blob: Blob
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function saveApplicationPackage(
  params: SavePackageParams,
  onProgress?: ProgressCallback,
  dirHandle?: FileSystemDirectoryHandle
): Promise<{ folderName: string; fileCount: number; method: 'folder' | 'zip'; warning?: string }> {
  const { cvData, profile, template, jobTitle, companyName, coverLetter, cvPreviewElement } = params;
  const company = sanitize(companyName || jobTitle);
  const folderName = buildFolderName(companyName || jobTitle, jobTitle);
  const includeCoverLetter = !!coverLetter;
  const totalSteps = includeCoverLetter ? 5 : 3;
  let step = 0;

  const report = (msg: string) => {
    step++;
    onProgress?.(msg, step / totalSteps);
  };

  // Generate CV blobs
  report('Generating CV Word document...');
  const cvDocxBlob = await generateTailoredCVDocxBlob(cvData, profile, template);

  report('Generating CV PDF...');
  const cvPdfBlob = await generateCVPDF(cvPreviewElement);

  // Generate cover letter blobs if included
  let clDocxBlob: Blob | undefined;
  let clPdfBlob: Blob | undefined;

  if (coverLetter) {
    report('Generating Cover Letter Word document...');
    clDocxBlob = await generateCoverLetterDocxBlob(coverLetter.content, jobTitle, companyName);

    report('Generating Cover Letter PDF...');
    clPdfBlob = await generateCoverLetterPDF(coverLetter.content, jobTitle, companyName);
  }

  // Build file list
  const files: Array<{ name: string; blob: Blob }> = [
    { name: `CV-${company}-${sanitize(template)}.docx`, blob: cvDocxBlob },
    { name: `CV-${company}-${sanitize(template)}.pdf`, blob: cvPdfBlob },
  ];

  if (clDocxBlob && clPdfBlob) {
    files.push(
      { name: `Cover-Letter-${company}.docx`, blob: clDocxBlob },
      { name: `Cover-Letter-${company}.pdf`, blob: clPdfBlob },
    );
  }

  report('Saving files...');

  // Always create a ZIP — this is the guaranteed-reliable delivery method.
  const zip = new JSZip();
  const zipFolder = zip.folder(folderName)!;
  for (const file of files) {
    zipFolder.file(file.name, file.blob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });

  // If we have a directory handle, try to write to the folder too.
  if (dirHandle) {
    try {
      console.log('[SavePackage] dirHandle name:', dirHandle.name);
      const subDirHandle = await dirHandle.getDirectoryHandle(folderName, { create: true });
      console.log('[SavePackage] Created subfolder:', folderName);

      for (const file of files) {
        console.log(`[SavePackage] Writing ${file.name} (${file.blob.size} bytes)...`);
        await writeFileToDirectory(subDirHandle, file.name, file.blob);
      }

      // Verify by reading back with a short delay to avoid browser cache
      await new Promise(r => setTimeout(r, 200));
      let verifiedCount = 0;
      for (const file of files) {
        try {
          const fh = await subDirHandle.getFileHandle(file.name);
          const written = await fh.getFile();
          console.log(`[SavePackage] Verified ${file.name}: ${written.size} bytes (expected ${file.blob.size})`);
          if (written.size > 0) {
            verifiedCount++;
          }
        } catch (e) {
          console.warn(`[SavePackage] Verify failed for ${file.name}:`, e);
        }
      }

      if (verifiedCount === files.length) {
        console.log('[SavePackage] All files verified on disk.');
        return { folderName, fileCount: files.length, method: 'folder' };
      }

      // Verification failed — fall back to ZIP
      console.warn(`[SavePackage] Only ${verifiedCount}/${files.length} verified. Downloading ZIP.`);
      saveAs(zipBlob, `${folderName}.zip`);
      return {
        folderName,
        fileCount: files.length,
        method: 'zip',
        warning: `Folder save failed verification (${verifiedCount}/${files.length} files). Downloaded as ZIP instead.`,
      };
    } catch (err) {
      console.error('[SavePackage] Folder write error:', err);
      // Fall through to ZIP
      saveAs(zipBlob, `${folderName}.zip`);
      return {
        folderName,
        fileCount: files.length,
        method: 'zip',
        warning: `Folder save failed: ${err instanceof Error ? err.message : 'unknown error'}. Downloaded as ZIP instead.`,
      };
    }
  }

  // No dirHandle — straight ZIP download
  console.log('[SavePackage] No directory handle — downloading ZIP.');
  saveAs(zipBlob, `${folderName}.zip`);
  return { folderName, fileCount: files.length, method: 'zip' };
}
