import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx';
import { saveAs } from 'file-saver';
import { detectLanguage } from './languageDetection';

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
