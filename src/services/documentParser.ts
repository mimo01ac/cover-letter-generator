// Document parsing utilities
// For PDF parsing, we use a simple text extraction approach

export async function parseTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export async function parsePdfFile(file: File): Promise<string> {
  // Dynamic import of pdf.js to avoid bundling issues
  // Users need to include pdfjs-dist in their dependencies
  try {
    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
    
    // Reference the worker file from public folder
    GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: arrayBuffer }).promise;

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => {
            if (typeof item === 'object' && 'str' in item) {
              return item.str;
            }
            return '';
          })
          .join(' ');
        fullText += pageText + '\n';
      } catch (pageError) {
        console.warn(`Error parsing page ${i}:`, pageError);
        // Continue with next page if one fails
      }
    }

    if (!fullText.trim()) {
      throw new Error('No text content could be extracted from the PDF');
    }

    return fullText.trim();
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}. Please try copying and pasting the text manually.`);
  }
}

export async function parseDocument(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'txt':
    case 'md':
      return parseTextFile(file);
    case 'pdf':
      return parsePdfFile(file);
    default:
      throw new Error(`Unsupported file type: ${extension}. Please use .txt, .md, or .pdf files.`);
  }
}

export function getFileTypeLabel(type: string): string {
  switch (type) {
    case 'cv':
      return 'CV/Resume';
    case 'experience':
      return 'Experience Document';
    case 'other':
      return 'Other Document';
    default:
      return type;
  }
}
