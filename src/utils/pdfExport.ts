import { jsPDF } from 'jspdf';
import { detectLanguage } from './languageDetection';
import type { TailoredCVData, CVTemplate, Profile } from '../types';

/* ── PDF generation via jsPDF (no html2canvas) ──────────────────────────
 *
 * Previous approach used html2pdf.js (html2canvas → jsPDF) which choked on
 * Tailwind CSS v4's oklch() color functions. This rewrite builds PDFs
 * directly from structured data using jsPDF's text API, completely
 * bypassing html2canvas and any CSS parsing issues.
 */

// A4 dimensions in mm
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 15;
const MARGIN_TOP = 15;
const MARGIN_BOTTOM = 15;
const CONTENT_W = PAGE_W - 2 * MARGIN_X;

// Colors
const BLACK = '#1a1a1a';
const GRAY = '#666666';
const DARK_GRAY = '#333333';
const LINE_COLOR = '#999999';

/** Helper: add a new page if y would overflow, returns (possibly reset) y. */
function checkPage(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - MARGIN_BOTTOM) {
    doc.addPage();
    return MARGIN_TOP;
  }
  return y;
}

/** Helper: render wrapped text, auto-paginating. Returns new y position. */
function renderWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const lines: string[] = doc.splitTextToSize(text, maxWidth);
  for (const line of lines) {
    y = checkPage(doc, y, lineHeight);
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

/** Helper: draw a horizontal rule. */
function drawHR(doc: jsPDF, y: number): number {
  doc.setDrawColor(LINE_COLOR);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
  return y + 2;
}

/** Helper: render a section heading with underline. Returns new y. */
function renderSectionHeading(
  doc: jsPDF,
  title: string,
  y: number,
  font: string = 'helvetica'
): number {
  y = checkPage(doc, y, 12);
  y += 4; // spacing before heading
  doc.setFont(font, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BLACK);
  doc.text(title.toUpperCase(), MARGIN_X, y);
  y += 2;
  y = drawHR(doc, y);
  y += 2;
  return y;
}

/** Helper: render bullet points. Returns new y. */
function renderBullets(
  doc: jsPDF,
  bullets: string[],
  y: number,
  font: string = 'helvetica'
): number {
  const bulletIndent = MARGIN_X + 3;
  const textIndent = MARGIN_X + 6;
  const textWidth = CONTENT_W - 6;
  const lineHeight = 4.2;

  doc.setFont(font, 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(BLACK);

  for (const bullet of bullets) {
    const lines: string[] = doc.splitTextToSize(bullet, textWidth);
    y = checkPage(doc, y, lines.length * lineHeight + 1);
    doc.text('\u2022', bulletIndent, y);
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], textIndent, y);
      y += lineHeight;
    }
    y += 0.5;
  }
  return y;
}

// ─── CV Header (shared across templates) ───────────────────────────────

function renderCVHeader(
  doc: jsPDF,
  profile: Profile,
  headline: string,
  font: string = 'helvetica'
): number {
  let y = MARGIN_TOP;

  // Name
  doc.setFont(font, 'bold');
  doc.setFontSize(18);
  doc.setTextColor(BLACK);
  doc.text(profile.name, PAGE_W / 2, y, { align: 'center' });
  y += 6;

  // Headline
  doc.setFont(font, 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(DARK_GRAY);
  doc.text(headline, PAGE_W / 2, y, { align: 'center' });
  y += 5;

  // Contact info
  const contactParts = [profile.phone, profile.email, profile.location].filter(Boolean);
  if (contactParts.length) {
    doc.setFontSize(8.5);
    doc.setTextColor(GRAY);
    doc.text(contactParts.join('  |  '), PAGE_W / 2, y, { align: 'center' });
    y += 3;
  }

  y = drawHR(doc, y);
  y += 2;
  return y;
}

// ─── Experience entries (shared) ────────────────────────────────────────

function renderExperience(
  doc: jsPDF,
  cvData: TailoredCVData,
  y: number,
  font: string = 'helvetica'
): number {
  for (const exp of cvData.experience ?? []) {
    y = checkPage(doc, y, 18);

    // Job title
    doc.setFont(font, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(BLACK);
    doc.text(exp.title, MARGIN_X, y);
    y += 4.5;

    // Company | Location    Period
    doc.setFont(font, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(DARK_GRAY);
    const companyLine = `${exp.company}${exp.location ? ` | ${exp.location}` : ''}`;
    doc.text(companyLine, MARGIN_X, y);
    doc.setTextColor(GRAY);
    doc.text(exp.period, PAGE_W - MARGIN_X, y, { align: 'right' });
    y += 4;

    // Bullets
    if (exp.bullets?.length) {
      doc.setTextColor(BLACK);
      y = renderBullets(doc, exp.bullets, y, font);
    }
    y += 2;
  }
  return y;
}

// ─── Education entries (shared) ─────────────────────────────────────────

function renderEducation(
  doc: jsPDF,
  cvData: TailoredCVData,
  y: number,
  font: string = 'helvetica'
): number {
  for (const edu of cvData.education ?? []) {
    y = checkPage(doc, y, 10);

    doc.setFont(font, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(BLACK);
    doc.text(edu.degree, MARGIN_X, y);

    doc.setFont(font, 'normal');
    doc.text(` | ${edu.institution}`, MARGIN_X + doc.getTextWidth(edu.degree), y);

    doc.setFontSize(8.5);
    doc.setTextColor(GRAY);
    doc.text(edu.period, PAGE_W - MARGIN_X, y, { align: 'right' });
    y += 4;

    if (edu.details) {
      doc.setFontSize(9);
      doc.setTextColor(DARK_GRAY);
      y = renderWrappedText(doc, edu.details, MARGIN_X, y, CONTENT_W, 4);
    }
    y += 1;
  }
  return y;
}

// ─── Optional sections (shared) ─────────────────────────────────────────

function renderOptionalSections(
  doc: jsPDF,
  cvData: TailoredCVData,
  y: number,
  font: string = 'helvetica'
): number {
  if (cvData.certifications?.length) {
    y = renderSectionHeading(doc, 'Certifications', y, font);
    doc.setFont(font, 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(BLACK);
    for (const cert of cvData.certifications) {
      y = checkPage(doc, y, 5);
      doc.text(cert, MARGIN_X, y);
      y += 4.5;
    }
  }

  if (cvData.languages?.length) {
    y = renderSectionHeading(doc, 'Languages', y, font);
    doc.setFont(font, 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(BLACK);
    y = checkPage(doc, y, 5);
    doc.text(cvData.languages.join(', '), MARGIN_X, y);
    y += 4.5;
  }

  return y;
}

// ─── Template 1: Classic Chronological ──────────────────────────────────

function buildClassicPDF(cvData: TailoredCVData, profile: Profile): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const font = 'helvetica';
  let y = renderCVHeader(doc, profile, cvData.headline, font);

  if (cvData.executiveSummary) {
    y = renderSectionHeading(doc, 'Professional Summary', y, font);
    doc.setFont(font, 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(BLACK);
    y = renderWrappedText(doc, cvData.executiveSummary, MARGIN_X, y, CONTENT_W, 4.2);
    y += 2;
  }

  if (cvData.experience?.length) {
    y = renderSectionHeading(doc, 'Work Experience', y, font);
    y = renderExperience(doc, cvData, y, font);
  }

  if (cvData.education?.length) {
    y = renderSectionHeading(doc, 'Education', y, font);
    y = renderEducation(doc, cvData, y, font);
  }

  if (cvData.coreCompetencies?.length) {
    y = renderSectionHeading(doc, 'Skills', y, font);
    doc.setFont(font, 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(BLACK);
    y = renderWrappedText(doc, cvData.coreCompetencies.join(', '), MARGIN_X, y, CONTENT_W, 4.2);
    y += 2;
  }

  renderOptionalSections(doc, cvData, y, font);
  return doc;
}

// ─── Template 2: Modern Hybrid ──────────────────────────────────────────

function buildHybridPDF(cvData: TailoredCVData, profile: Profile): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const font = 'helvetica';
  let y = renderCVHeader(doc, profile, cvData.headline, font);

  if (cvData.executiveSummary) {
    y = renderSectionHeading(doc, 'Professional Summary', y, font);
    doc.setFont(font, 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(BLACK);
    y = renderWrappedText(doc, cvData.executiveSummary, MARGIN_X, y, CONTENT_W, 4.2);
    y += 2;
  }

  if (cvData.coreCompetencies?.length) {
    y = renderSectionHeading(doc, 'Core Competencies', y, font);
    doc.setFont(font, 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(BLACK);

    // 3-column grid layout
    const colWidth = CONTENT_W / 3;
    for (let i = 0; i < cvData.coreCompetencies.length; i += 3) {
      y = checkPage(doc, y, 5);
      const row = cvData.coreCompetencies.slice(i, i + 3);
      row.forEach((skill, j) => {
        doc.text(skill, MARGIN_X + j * colWidth, y);
      });
      y += 4.5;
    }
    y += 2;
  }

  if (cvData.experience?.length) {
    y = renderSectionHeading(doc, 'Professional Experience', y, font);
    y = renderExperience(doc, cvData, y, font);
  }

  if (cvData.careerHighlights?.length) {
    y = renderSectionHeading(doc, 'Key Achievements', y, font);
    y = renderBullets(doc, cvData.careerHighlights, y, font);
    y += 2;
  }

  if (cvData.education?.length) {
    y = renderSectionHeading(doc, 'Education', y, font);
    y = renderEducation(doc, cvData, y, font);
  }

  renderOptionalSections(doc, cvData, y, font);
  return doc;
}

// ─── Template 3: Executive Impact ───────────────────────────────────────

function buildExecutivePDF(cvData: TailoredCVData, profile: Profile): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const font = 'times'; // Georgia equivalent in jsPDF standard fonts
  let y = renderCVHeader(doc, profile, cvData.headline, font);

  if (cvData.executiveSummary) {
    y = renderSectionHeading(doc, 'Executive Summary', y, font);
    doc.setFont(font, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(BLACK);
    y = renderWrappedText(doc, cvData.executiveSummary, MARGIN_X, y, CONTENT_W, 4.5);
    y += 2;
  }

  if (cvData.careerHighlights?.length) {
    y = renderSectionHeading(doc, 'Career Highlights', y, font);
    y = renderBullets(doc, cvData.careerHighlights, y, font);
    y += 2;
  }

  if (cvData.coreCompetencies?.length) {
    y = renderSectionHeading(doc, 'Core Competencies', y, font);
    doc.setFont(font, 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(BLACK);
    y = checkPage(doc, y, 5);
    y = renderWrappedText(doc, cvData.coreCompetencies.join(' \u2022 '), MARGIN_X, y, CONTENT_W, 4.2);
    y += 2;
  }

  if (cvData.experience?.length) {
    y = renderSectionHeading(doc, 'Professional Experience', y, font);
    y = renderExperience(doc, cvData, y, font);
  }

  if (cvData.education?.length) {
    y = renderSectionHeading(doc, 'Education', y, font);
    y = renderEducation(doc, cvData, y, font);
  }

  renderOptionalSections(doc, cvData, y, font);
  return doc;
}

// ─── Public API ─────────────────────────────────────────────────────────

export async function generateCVPDF(
  cvData: TailoredCVData,
  profile: Profile,
  template: CVTemplate
): Promise<Blob> {
  let doc: jsPDF;
  switch (template) {
    case 'hybrid':
      doc = buildHybridPDF(cvData, profile);
      break;
    case 'executive':
      doc = buildExecutivePDF(cvData, profile);
      break;
    case 'classic':
    default:
      doc = buildClassicPDF(cvData, profile);
      break;
  }
  return doc.output('blob');
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

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = MARGIN_TOP + 5;

  // Heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(BLACK);
  const headingLines: string[] = doc.splitTextToSize(heading, CONTENT_W);
  for (const line of headingLines) {
    doc.text(line, MARGIN_X, y);
    y += 6;
  }
  y += 4;

  // Body paragraphs
  const paragraphs = coverLetterText
    .split('\n\n')
    .filter(p => p.trim().length > 0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(BLACK);

  for (const para of paragraphs) {
    const cleanText = para.replace(/\n/g, ' ').trim();
    y = renderWrappedText(doc, cleanText, MARGIN_X, y, CONTENT_W, 5);
    y += 3; // paragraph spacing
  }

  return doc.output('blob');
}
