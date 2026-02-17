import html2pdf from 'html2pdf.js';
import { detectLanguage } from './languageDetection';

const COLOR_PROPS = [
  'color', 'background-color', 'border-color',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'outline-color', 'text-decoration-color',
];

/**
 * html2canvas has its own CSS parser that cannot handle oklch() (Tailwind v4).
 * This callback runs inside html2canvas's onclone — after it clones the document
 * into an iframe but before it renders.
 *
 * Step 1: Inline computed (browser-resolved rgb) color values on every element.
 * Step 2: Replace oklch() in stylesheet text with a safe fallback so the parser
 *         doesn't throw. The inline styles from step 1 take precedence anyway.
 */
function sanitizeColorsForHtml2Canvas(clonedDoc: Document): void {
  const win = clonedDoc.defaultView;
  if (!win) return;

  // Step 1 — inline resolved colors on every element
  const allElements = clonedDoc.body.querySelectorAll('*');
  for (const el of Array.from(allElements)) {
    if (!(el instanceof win.HTMLElement)) continue;
    try {
      const computed = win.getComputedStyle(el);
      for (const prop of COLOR_PROPS) {
        const val = computed.getPropertyValue(prop);
        if (val) {
          el.style.setProperty(prop, val);
        }
      }
    } catch {
      // skip elements where getComputedStyle fails
    }
  }

  // Step 2 — neutralise oklch() in all <style> blocks
  const styles = clonedDoc.querySelectorAll('style');
  for (const style of Array.from(styles)) {
    if (style.textContent && style.textContent.includes('oklch')) {
      style.textContent = style.textContent.replace(/oklch\([^)]*\)/g, 'rgb(0,0,0)');
    }
  }
}

const PDF_OPTIONS = {
  margin: [10, 10, 10, 10] as [number, number, number, number],
  image: { type: 'jpeg' as const, quality: 0.98 },
  html2canvas: {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    onclone: (clonedDoc: Document) => sanitizeColorsForHtml2Canvas(clonedDoc),
  },
  jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
  pagebreak: { mode: ['avoid-all', 'css'] },
};

export async function generateCVPDF(cvPreviewElement: HTMLElement): Promise<Blob> {
  const clone = cvPreviewElement.cloneNode(true) as HTMLElement;
  clone.style.width = '794px'; // A4 width at 96dpi
  clone.style.maxHeight = 'none';
  clone.style.overflow = 'visible';
  clone.style.position = 'absolute';
  clone.style.left = '-9999px';
  clone.style.top = '0';
  document.body.appendChild(clone);

  try {
    const blob: Blob = await html2pdf()
      .set({ ...PDF_OPTIONS, filename: 'cv.pdf' })
      .from(clone)
      .outputPdf('blob');
    return blob;
  } finally {
    document.body.removeChild(clone);
  }
}

export async function generateCoverLetterPDF(
  coverLetterText: string,
  jobTitle: string,
  companyName?: string
): Promise<Blob> {
  const language = detectLanguage(coverLetterText);
  const heading = language === 'da'
    ? (companyName ? `Ansøgning til ${jobTitle} hos ${companyName}` : `Ansøgning til ${jobTitle}`)
    : (companyName ? `Application for ${jobTitle} at ${companyName}` : `Application for ${jobTitle}`);

  const paragraphs = coverLetterText
    .split('\n\n')
    .filter(p => p.trim().length > 0)
    .map(p => `<p style="margin: 0 0 12px 0; line-height: 1.5;">${p.replace(/\n/g, ' ').trim()}</p>`)
    .join('');

  const html = `
    <div style="font-family: Calibri, Arial, sans-serif; font-size: 12pt; color: #1a1a1a; padding: 20px 30px;">
      <h1 style="font-size: 16pt; font-weight: bold; margin: 0 0 20px 0; color: #111;">${heading}</h1>
      ${paragraphs}
    </div>
  `;

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.backgroundColor = '#ffffff';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const blob: Blob = await html2pdf()
      .set({ ...PDF_OPTIONS, filename: 'cover-letter.pdf' })
      .from(container)
      .outputPdf('blob');
    return blob;
  } finally {
    document.body.removeChild(container);
  }
}
