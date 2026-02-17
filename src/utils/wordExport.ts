import { Document, Paragraph, TextRun, HeadingLevel, Packer, BorderStyle, AlignmentType, TabStopPosition, TabStopType } from 'docx';
import { saveAs } from 'file-saver';
import { detectLanguage } from './languageDetection';
import type { TailoredCVData, CVTemplate, Profile } from '../types';

export async function downloadCoverLetterAsWord(
  coverLetter: string,
  jobTitle: string,
  companyName?: string
): Promise<void> {
  // Detect language and create appropriate heading
  const language = detectLanguage(coverLetter);

  let headingText: string;
  if (language === 'da') {
    // Danish
    headingText = companyName
      ? `Ansøgning til ${jobTitle} hos ${companyName}`
      : `Ansøgning til ${jobTitle}`;
  } else {
    // English (default)
    headingText = companyName
      ? `Application for ${jobTitle} at ${companyName}`
      : `Application for ${jobTitle}`;
  }

  // Split cover letter into paragraphs
  const paragraphs = coverLetter
    .split('\n\n')
    .filter(p => p.trim().length > 0);

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Heading
          new Paragraph({
            children: [
              new TextRun({
                text: headingText,
                bold: true,
                size: 28, // 14pt
              }),
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: {
              after: 400, // Space after heading
            },
          }),
          // Cover letter paragraphs
          ...paragraphs.map(
            (text) =>
              new Paragraph({
                children: [
                  new TextRun({
                    text: text.replace(/\n/g, ' ').trim(),
                    size: 24, // 12pt
                  }),
                ],
                spacing: {
                  after: 200, // Space between paragraphs
                },
              })
          ),
        ],
      },
    ],
  });

  // Generate and download
  const blob = await Packer.toBlob(doc);
  const filename = companyName
    ? `Application-${companyName.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.docx`
    : `Application-${jobTitle.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.docx`;

  saveAs(blob, filename);
}

// --- Tailored CV Word Export ---
// All templates are ATS-friendly single-column layouts

function sectionHeading(text: string, font: string = 'Calibri'): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 22, // 11pt
        font,
      }),
    ],
    spacing: { before: 300, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' } },
  });
}

function bulletParagraph(text: string, font: string = 'Calibri'): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text, size: 20, font }),
    ],
    bullet: { level: 0 },
    spacing: { after: 40 },
  });
}

function cvHeader(profile: Profile, headline: string, font: string = 'Calibri'): Paragraph[] {
  const contactParts = [profile.phone, profile.email, profile.location].filter(Boolean);
  return [
    new Paragraph({
      children: [
        new TextRun({ text: profile.name, bold: true, size: 36, font }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: headline, size: 22, font, color: '333333' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: contactParts.join(' | '), size: 18, font, color: '666666' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' } },
    }),
  ];
}

function experienceEntries(cvData: TailoredCVData, font: string = 'Calibri'): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  cvData.experience?.forEach(exp => {
    paragraphs.push(new Paragraph({
      children: [
        new TextRun({ text: exp.title, bold: true, size: 22, font }),
      ],
      spacing: { before: 160, after: 20 },
    }));
    paragraphs.push(new Paragraph({
      children: [
        new TextRun({ text: `${exp.company}${exp.location ? ` | ${exp.location}` : ''}`, size: 20, font }),
        new TextRun({ text: `\t${exp.period}`, size: 18, font, color: '666666' }),
      ],
      spacing: { after: 60 },
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    }));
    exp.bullets?.forEach(b => paragraphs.push(bulletParagraph(b, font)));
  });
  return paragraphs;
}

function educationEntries(cvData: TailoredCVData, font: string = 'Calibri'): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  cvData.education?.forEach(edu => {
    paragraphs.push(new Paragraph({
      children: [
        new TextRun({ text: edu.degree, bold: true, size: 20, font }),
        new TextRun({ text: ` | ${edu.institution}`, size: 20, font }),
        ...(edu.details ? [new TextRun({ text: ` - ${edu.details}`, size: 18, font, color: '666666' })] : []),
        new TextRun({ text: `\t${edu.period}`, size: 18, font, color: '666666' }),
      ],
      spacing: { after: 60 },
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    }));
  });
  return paragraphs;
}

function optionalSections(cvData: TailoredCVData, font: string = 'Calibri'): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  if (cvData.certifications?.length) {
    paragraphs.push(sectionHeading('Certifications', font));
    cvData.certifications.forEach(c => {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: c, size: 20, font })],
        spacing: { after: 40 },
      }));
    });
  }
  if (cvData.languages?.length) {
    paragraphs.push(sectionHeading('Languages', font));
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: cvData.languages.join(', '), size: 20, font })],
    }));
  }
  return paragraphs;
}

// Template 1: Classic Chronological
// Header → Summary → Work Experience → Education → Skills → Optional
function buildClassicDocx(cvData: TailoredCVData, profile: Profile): Document {
  const font = 'Calibri';
  const children: Paragraph[] = [];

  children.push(...cvHeader(profile, cvData.headline, font));

  // Professional Summary
  if (cvData.executiveSummary) {
    children.push(sectionHeading('Professional Summary', font));
    children.push(new Paragraph({
      children: [new TextRun({ text: cvData.executiveSummary, size: 20, font })],
      spacing: { after: 100 },
    }));
  }

  // Work Experience
  if (cvData.experience?.length) {
    children.push(sectionHeading('Work Experience', font));
    children.push(...experienceEntries(cvData, font));
  }

  // Education
  if (cvData.education?.length) {
    children.push(sectionHeading('Education', font));
    children.push(...educationEntries(cvData, font));
  }

  // Skills (comma-separated)
  if (cvData.coreCompetencies?.length) {
    children.push(sectionHeading('Skills', font));
    children.push(new Paragraph({
      children: [new TextRun({ text: cvData.coreCompetencies.join(', '), size: 20, font })],
      spacing: { after: 100 },
    }));
  }

  children.push(...optionalSections(cvData, font));

  return new Document({
    sections: [{ properties: {}, children }],
  });
}

// Template 2: Modern Hybrid (Combination)
// Header → Summary → Core Competencies (grid) → Experience → Key Achievements → Education → Certs
function buildHybridDocx(cvData: TailoredCVData, profile: Profile): Document {
  const font = 'Calibri';
  const children: Paragraph[] = [];

  children.push(...cvHeader(profile, cvData.headline, font));

  // Professional Summary
  if (cvData.executiveSummary) {
    children.push(sectionHeading('Professional Summary', font));
    children.push(new Paragraph({
      children: [new TextRun({ text: cvData.executiveSummary, size: 20, font })],
      spacing: { after: 100 },
    }));
  }

  // Core Competencies - tabbed grid (3 per line)
  if (cvData.coreCompetencies?.length) {
    children.push(sectionHeading('Core Competencies', font));
    for (let i = 0; i < cvData.coreCompetencies.length; i += 3) {
      const row = cvData.coreCompetencies.slice(i, i + 3);
      const runs: TextRun[] = [];
      row.forEach((skill, j) => {
        if (j > 0) runs.push(new TextRun({ text: '\t', size: 20, font }));
        runs.push(new TextRun({ text: skill, size: 20, font }));
      });
      children.push(new Paragraph({
        children: runs,
        spacing: { after: 30 },
        tabStops: [
          { type: TabStopType.LEFT, position: 3200 },
          { type: TabStopType.LEFT, position: 6400 },
        ],
      }));
    }
  }

  // Professional Experience
  if (cvData.experience?.length) {
    children.push(sectionHeading('Professional Experience', font));
    children.push(...experienceEntries(cvData, font));
  }

  // Key Achievements
  if (cvData.careerHighlights?.length) {
    children.push(sectionHeading('Key Achievements', font));
    cvData.careerHighlights.forEach(h => children.push(bulletParagraph(h, font)));
  }

  // Education
  if (cvData.education?.length) {
    children.push(sectionHeading('Education', font));
    children.push(...educationEntries(cvData, font));
  }

  children.push(...optionalSections(cvData, font));

  return new Document({
    sections: [{ properties: {}, children }],
  });
}

// Template 3: Executive Impact
// Header (with designations) → Executive Summary (substantial) → Career Highlights → Core Competencies → Experience → Education
function buildExecutiveDocx(cvData: TailoredCVData, profile: Profile): Document {
  const font = 'Georgia';
  const children: Paragraph[] = [];

  children.push(...cvHeader(profile, cvData.headline, font));

  // Executive Summary - more substantial, paragraph format
  if (cvData.executiveSummary) {
    children.push(sectionHeading('Executive Summary', font));
    children.push(new Paragraph({
      children: [new TextRun({ text: cvData.executiveSummary, size: 21, font })],
      spacing: { after: 120, line: 300 },
    }));
  }

  // Career Highlights - greatest hits across career
  if (cvData.careerHighlights?.length) {
    children.push(sectionHeading('Career Highlights', font));
    cvData.careerHighlights.forEach(h => children.push(bulletParagraph(h, font)));
  }

  // Core Competencies
  if (cvData.coreCompetencies?.length) {
    children.push(sectionHeading('Core Competencies', font));
    children.push(new Paragraph({
      children: [new TextRun({ text: cvData.coreCompetencies.join(' \u2022 '), size: 20, font })],
      spacing: { after: 100 },
    }));
  }

  // Professional Experience
  if (cvData.experience?.length) {
    children.push(sectionHeading('Professional Experience', font));
    children.push(...experienceEntries(cvData, font));
  }

  // Education
  if (cvData.education?.length) {
    children.push(sectionHeading('Education', font));
    children.push(...educationEntries(cvData, font));
  }

  children.push(...optionalSections(cvData, font));

  return new Document({
    sections: [{ properties: {}, children }],
  });
}

export async function downloadTailoredCVAsWord(
  cvData: TailoredCVData,
  profile: Profile,
  template: CVTemplate,
  jobTitle: string,
  companyName?: string
): Promise<void> {
  let doc: Document;

  switch (template) {
    case 'hybrid':
      doc = buildHybridDocx(cvData, profile);
      break;
    case 'executive':
      doc = buildExecutiveDocx(cvData, profile);
      break;
    case 'classic':
    default:
      doc = buildClassicDocx(cvData, profile);
      break;
  }

  const blob = await Packer.toBlob(doc);
  const date = new Date().toISOString().split('T')[0];
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '-');

  const filename = companyName
    ? `CV-${sanitize(companyName)}-${sanitize(template)}-${date}.docx`
    : `CV-${sanitize(jobTitle)}-${sanitize(template)}-${date}.docx`;

  saveAs(blob, filename);
}
