// Simple language detection based on common Danish words
const danishWords = [
  'og', 'det', 'at', 'en', 'til', 'er', 'i', 'på', 'de', 'med', 'han', 'af', 'for', 'ikke', 'der',
  'var', 'mig', 'sig', 'om', 'har', 'hun', 'nu', 'over', 'ud', 'da', 'fra', 'denne', 'eller',
  'hvad', 'hans', 'hvor', 'ham', 'har', 'ville', 'skulle', 'anden', 'arbejde', 'erfaring', 'år',
  'kandidat', 'ansøgning', 'virksomhed', 'rolle', 'kompetencer', 'projektleder', 'udvikler'
];

export function detectLanguage(text: string): 'en' | 'da' {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);
  
  let danishCount = 0;
  let totalWords = 0;

  for (const word of words) {
    // Remove punctuation
    const cleanWord = word.replace(/[^\w]/g, '');
    
    if (cleanWord.length > 2) {
      totalWords++;
      if (danishWords.includes(cleanWord)) {
        danishCount++;
      }
    }
  }

  // If more than 5% of words are Danish, assume Danish
  const danishRatio = totalWords > 0 ? danishCount / totalWords : 0;
  return danishRatio > 0.05 ? 'da' : 'en';
}
