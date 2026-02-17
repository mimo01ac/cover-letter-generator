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

export async function changeBaseFolder(): Promise<string | null> {
  if (!hasFileSystemAccess()) return null;
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await set(DIR_HANDLE_KEY, handle);
    return handle.name;
  } catch (err) {
    // User cancelled the picker — not an error
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    // Any other error — rethrow so caller can handle it
    throw err;
  }
}

export async function clearBaseFolder(): Promise<void> {
  try {
    await del(DIR_HANDLE_KEY);
  } catch {
    // If deletion fails, ignore — next save will just re-prompt
  }
}

/** Call this early — while user-gesture context is still active — to secure write permission. */
export async function acquireDirectoryHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  if (!hasFileSystemAccess()) return undefined;

  try {
    let handle = await get<FileSystemDirectoryHandle>(DIR_HANDLE_KEY);

    if (handle) {
      // queryPermission doesn't consume user gesture; requestPermission does
      const queryPerm = (handle as unknown as { queryPermission: (desc: { mode: string }) => Promise<string> }).queryPermission;
      const status = queryPerm
        ? await queryPerm.call(handle, { mode: 'readwrite' })
        : 'prompt';
      if (status === 'granted') return handle;

      // Need to request — must still be in user gesture
      const perm = await handle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') return handle;
    }

    // No stored handle or permission denied — prompt user
    handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await set(DIR_HANDLE_KEY, handle);
    return handle;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return undefined;
    throw err;
  }
}

function buildFolderName(companyName: string, jobTitle: string): string {
  const raw = `${companyName} - ${jobTitle}`;
  // Filesystem-safe: remove characters invalid on Windows/macOS
  return raw.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim();
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
  /** Pre-acquired directory handle — call acquireDirectoryHandle() in the click handler */
  dirHandle?: FileSystemDirectoryHandle
): Promise<{ folderName: string; fileCount: number }> {
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

  const baseHandle = dirHandle;

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

  if (baseHandle) {
    // Chrome/Edge: write directly to filesystem
    const subDirHandle = await baseHandle.getDirectoryHandle(folderName, { create: true });

    for (const file of files) {
      await writeFileToDirectory(subDirHandle, file.name, file.blob);
    }
  } else {
    // Firefox/Safari: create ZIP
    const zip = new JSZip();
    const folder = zip.folder(folderName)!;

    for (const file of files) {
      folder.file(file.name, file.blob);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, `${folderName}.zip`);
  }

  return { folderName, fileCount: files.length };
}
