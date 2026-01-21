export interface ScrapedJobData {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
}

const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

async function fetchWithProxy(url: string): Promise<string> {
  // First try direct fetch (some sites may allow it)
  try {
    const response = await fetch(url, {
      mode: 'cors',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (response.ok) {
      return await response.text();
    }
  } catch {
    // Direct fetch failed, try proxies
  }

  // Try CORS proxies
  for (const proxyFn of CORS_PROXIES) {
    try {
      const proxyUrl = proxyFn(url);
      const response = await fetch(proxyUrl);
      if (response.ok) {
        return await response.text();
      }
    } catch {
      // This proxy failed, try next
    }
  }

  throw new Error('CORS_BLOCKED');
}

export async function scrapeJobPosting(url: string): Promise<ScrapedJobData> {
  try {
    const html = await fetchWithProxy(url);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extract job title
    let jobTitle = extractJobTitle(doc);

    // Extract company name
    let companyName = extractCompanyName(doc);

    // Extract job description
    let jobDescription = extractJobDescription(doc);

    if (!jobTitle || !jobDescription) {
      throw new Error('Could not extract job information from the URL');
    }

    return {
      jobTitle: jobTitle.trim(),
      companyName: companyName.trim(),
      jobDescription: jobDescription.trim(),
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'CORS_BLOCKED') {
      throw new Error('Unable to access this URL due to website restrictions. Please copy and paste the job details manually.');
    }
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Unable to access this URL. Please check the URL or copy and paste the job details manually.');
    }
    throw error instanceof Error ? error : new Error('Failed to scrape job posting');
  }
}

function extractJobTitle(doc: Document): string {
  // Try common job title selectors (including jobindex.dk specific)
  const selectors = [
    // Jobindex.dk specific
    '.jobad-header h1',
    '.PaidJob-inner h1',
    '[class*="JobHeader"] h1',
    // Generic selectors
    'h1[data-testid="jobTitle"]',
    'h1.job-title',
    'h1[class*="title"]',
    '[data-testid="jobTitle"]',
    '[class*="jobTitle"]',
    '[class*="job-title"]',
    'h1',
  ];

  for (const selector of selectors) {
    const element = doc.querySelector(selector);
    if (element && element.textContent) {
      const text = element.textContent.trim();
      if (text.length > 0 && text.length < 200) {
        return text;
      }
    }
  }

  // Fallback: check meta og:title
  const ogTitle = doc.querySelector('meta[property="og:title"]');
  if (ogTitle && ogTitle.getAttribute('content')) {
    return ogTitle.getAttribute('content') || '';
  }

  return '';
}

function extractCompanyName(doc: Document): string {
  // Try common company name selectors (including jobindex.dk specific)
  const selectors = [
    // Jobindex.dk specific
    '.jobad-header a[href*="/virksomhed/"]',
    '.PaidJob-inner a[href*="/virksomhed/"]',
    '[class*="CompanyLink"]',
    '.jix-toolbar-top a[href*="/virksomhed/"]',
    // Generic selectors
    '[data-testid="companyName"]',
    '[class*="companyName"]',
    '[class*="company-name"]',
    'span[class*="company"]',
    'a[class*="company"]',
  ];

  for (const selector of selectors) {
    const element = doc.querySelector(selector);
    if (element && element.textContent) {
      const text = element.textContent.trim();
      if (text.length > 0 && text.length < 100) {
        return text;
      }
    }
  }

  // Try to extract from page title
  const title = doc.title;
  if (title && title.includes(' at ')) {
    const parts = title.split(' at ');
    if (parts.length > 1) {
      return parts[1].split(' |')[0].trim();
    }
  }

  return '';
}

function extractJobDescription(doc: Document): string {
  // Try common job description selectors (including jobindex.dk specific)
  const selectors = [
    // Jobindex.dk specific
    '.jobad-content',
    '.PaidJob-inner .jobad-content',
    '[class*="JobDescription"]',
    '.jix-content',
    // Generic selectors
    '[data-testid="job-description"]',
    '[data-testid="jobDescription"]',
    '[class*="jobDescription"]',
    '[class*="job-description"]',
    'main[class*="content"]',
    '[role="main"]',
    'article',
    'section[class*="description"]',
  ];

  for (const selector of selectors) {
    const element = doc.querySelector(selector);
    if (element) {
      const text = cleanText(element.textContent || '');
      if (text.length > 100) {
        return text;
      }
    }
  }

  // Fallback: get main content
  let main = doc.querySelector('main') || doc.querySelector('[role="main"]') || doc.body;
  if (main) {
    let text = cleanText(main.textContent || '');
    
    // Remove very long content (likely includes entire page)
    if (text.length > 5000) {
      // Try to extract just job details section
      const jobContent = main.querySelector(
        '[class*="job"], [class*="description"], article, section'
      );
      if (jobContent) {
        text = cleanText(jobContent.textContent || '');
      }
    }

    if (text.length > 100) {
      return text.substring(0, 5000); // Limit to 5000 chars
    }
  }

  return '';
}

function cleanText(text: string): string {
  // Remove extra whitespace and normalize
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\n\r]+/g, '\n')
    .trim();
}
