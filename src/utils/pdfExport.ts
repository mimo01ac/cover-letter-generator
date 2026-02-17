import html2pdf from 'html2pdf.js';
import { detectLanguage } from './languageDetection';

/* ── oklch → rgb resolution via CSSOM ──────────────────────────────────
 *
 * html2canvas ships its own CSS parser that chokes on oklch() (Tailwind v4).
 * Previous attempts to fix this via onclone (modifying <style> textContent or
 * inlining computed styles) failed because html2canvas reads CSS through the
 * CSSOM API (document.styleSheets → cssRules), NOT from <style> text.
 *
 * The fix: before html2pdf runs, walk every CSSStyleRule in every stylesheet,
 * find property values containing oklch(), resolve them to hex via the canvas
 * 2d context trick (ctx.fillStyle normalises any CSS color to #rrggbb), and
 * patch the CSSOM rule in place. After html2pdf finishes, restore originals.
 */

type RuleBackup = { rule: CSSStyleRule; prop: string; value: string; priority: string };

/** Use canvas 2d fillStyle to resolve oklch() to hex. */
function resolveOklchValue(value: string): string {
  return value.replace(/oklch\([^)]*\)/g, (match) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '#000000';
      ctx.fillStyle = '#000000'; // reset
      ctx.fillStyle = match;     // browser normalises to hex
      return ctx.fillStyle;
    } catch {
      return '#000000';
    }
  });
}

/** Recursively walk CSS rules including @layer, @media, @supports groups. */
function walkCSSRules(rules: CSSRuleList, backups: RuleBackup[]): void {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];

    // Recurse into grouping rules (@media, @supports, @layer, etc.)
    if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
      walkCSSRules((rule as CSSGroupingRule).cssRules, backups);
      continue;
    }

    if (!(rule instanceof CSSStyleRule)) continue;

    const style = rule.style;
    for (let j = 0; j < style.length; j++) {
      const prop = style[j];
      const val = style.getPropertyValue(prop);
      if (val.includes('oklch')) {
        const priority = style.getPropertyPriority(prop);
        backups.push({ rule, prop, value: val, priority });
        style.setProperty(prop, resolveOklchValue(val), priority);
      }
    }
  }
}

/** Replace oklch() in all CSSOM rules with resolved hex values. Returns backups for restore. */
function neutralizeOklchInStylesheets(): RuleBackup[] {
  const backups: RuleBackup[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walkCSSRules(sheet.cssRules, backups);
    } catch {
      // Cross-origin stylesheets throw SecurityError — skip them
    }
  }
  console.log(`[PDF] Neutralized ${backups.length} oklch rules in CSSOM`);
  return backups;
}

/** Restore original oklch values in CSSOM. */
function restoreOklch(backups: RuleBackup[]): void {
  for (const { rule, prop, value, priority } of backups) {
    try {
      rule.style.setProperty(prop, value, priority);
    } catch { /* best effort */ }
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

  const backups = neutralizeOklchInStylesheets();
  try {
    const blob: Blob = await html2pdf()
      .set({ ...PDF_OPTIONS, filename: 'cv.pdf' })
      .from(clone)
      .outputPdf('blob');
    return blob;
  } finally {
    restoreOklch(backups);
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

  const backups = neutralizeOklchInStylesheets();
  try {
    const blob: Blob = await html2pdf()
      .set({ ...PDF_OPTIONS, filename: 'cover-letter.pdf' })
      .from(container)
      .outputPdf('blob');
    return blob;
  } finally {
    restoreOklch(backups);
    document.body.removeChild(container);
  }
}
