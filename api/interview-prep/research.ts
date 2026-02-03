import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ResearchRequest {
  action?: 'research' | 'scrape';
  // For research action
  companyName?: string;
  industry?: string;
  companyUrl?: string;
  // For scrape action
  url?: string;
}

interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// ============ SCRAPE FUNCTIONALITY ============

const EXTRACTION_PROMPT = `You are extracting job posting information from HTML content. Extract the following fields:

1. **jobTitle**: The job title/position name
2. **companyName**: The name of the company hiring
3. **jobDescription**: The full job description including responsibilities, requirements, qualifications, benefits, etc. Preserve the structure with line breaks.
4. **companyUrl**: The company's website URL if mentioned, or null if not found

Return ONLY a JSON object with these exact fields. Do not include any other text or markdown formatting.

Example output:
{"jobTitle": "Senior Software Engineer", "companyName": "Acme Corp", "jobDescription": "We are looking for...", "companyUrl": "https://acme.com"}

If you cannot find a field, use empty string for jobTitle/companyName/jobDescription, and null for companyUrl.`;

const COMPANY_SEARCH_PROMPT = `Given this company name, provide the most likely official company website URL.

Company: {companyName}

Return ONLY the URL (e.g., "https://company.com") or "null" if you cannot determine it with confidence. Do not include any other text.`;

// Special handler for Workday job postings (JavaScript-heavy sites)
interface WorkdayJobData {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  companyUrl: string | null;
}

async function fetchWorkdayJob(url: string): Promise<WorkdayJobData | null> {
  // Parse Workday URL pattern: https://{company}.wd3.myworkdayjobs.com/{locale}/{site}/job/{location}/{title}_{id}
  const workdayPattern = /https?:\/\/([^.]+)\.wd\d*\.myworkdayjobs\.com\/([^/]+)\/([^/]+)\/job\/(.+)/;
  const match = url.match(workdayPattern);

  if (!match) return null;

  const [, company, locale, site, jobPath] = match;

  // Workday API endpoint
  const apiUrl = `https://${company}.wd3.myworkdayjobs.com/wday/cxs/${company}/${site}/job/${jobPath}`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Workday API failed:', response.status);
      return null;
    }

    const data = await response.json();

    // Extract job data from Workday response
    const jobPosting = data.jobPostingInfo || data;

    // Build description from various fields
    const descriptionParts: string[] = [];

    if (jobPosting.jobDescription) {
      // Workday returns HTML, clean it
      descriptionParts.push(jobPosting.jobDescription.replace(/<[^>]+>/g, '\n').replace(/\n{3,}/g, '\n\n').trim());
    }

    if (jobPosting.qualifications) {
      descriptionParts.push('\n\nQualifications:\n' + jobPosting.qualifications.replace(/<[^>]+>/g, '\n').trim());
    }

    if (jobPosting.responsibilities) {
      descriptionParts.push('\n\nResponsibilities:\n' + jobPosting.responsibilities.replace(/<[^>]+>/g, '\n').trim());
    }

    // Try to get additional details
    if (data.jobRequisition) {
      if (data.jobRequisition.bulletFields) {
        for (const field of data.jobRequisition.bulletFields) {
          if (field.value) {
            descriptionParts.push(`\n${field.label || 'Details'}: ${field.value}`);
          }
        }
      }
    }

    return {
      jobTitle: jobPosting.title || jobPosting.jobTitle || '',
      companyName: jobPosting.company || company.toUpperCase() || '',
      jobDescription: descriptionParts.join('\n').trim(),
      companyUrl: jobPosting.companyUrl || null,
    };
  } catch (error) {
    console.error('Workday fetch error:', error);
    return null;
  }
}

async function fetchWithRetry(url: string, retries = 2): Promise<string> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  };

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, {
        headers,
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      if (i === retries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }

  throw new Error('Failed to fetch after retries');
}

function extractTextContent(html: string): string {
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '');

  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (text.length > 50000) {
    text = text.substring(0, 50000);
  }

  return text;
}

async function handleScrape(req: VercelRequest, res: VercelResponse, url: string) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  try {
    // Check for Workday URLs first (they require special handling)
    if (url.includes('.myworkdayjobs.com')) {
      const workdayData = await fetchWorkdayJob(url);
      if (workdayData && (workdayData.jobTitle || workdayData.jobDescription)) {
        // Use Claude to find company URL if not provided
        if (!workdayData.companyUrl && workdayData.companyName) {
          const anthropic = new Anthropic({ apiKey: anthropicKey });
          try {
            const searchResponse = await anthropic.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 100,
              temperature: 0,
              messages: [{
                role: 'user',
                content: `Given this company name, provide the most likely official company website URL.\n\nCompany: ${workdayData.companyName}\n\nReturn ONLY the URL (e.g., "https://company.com") or "null" if you cannot determine it with confidence. Do not include any other text.`,
              }],
            });

            const urlResponse = searchResponse.content[0].type === 'text'
              ? searchResponse.content[0].text.trim()
              : '';

            if (urlResponse && urlResponse !== 'null' && urlResponse.startsWith('http')) {
              workdayData.companyUrl = urlResponse;
            }
          } catch (error) {
            console.error('Company URL search failed:', error);
          }
        }

        return res.status(200).json(workdayData);
      }
    }

    const html = await fetchWithRetry(url);
    const textContent = extractTextContent(html);

    if (textContent.length < 100) {
      return res.status(400).json({
        error: 'Could not extract content from page. The page may require JavaScript or authentication.'
      });
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const extractionResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `${EXTRACTION_PROMPT}\n\nHTML Content:\n${textContent}`,
      }],
    });

    const responseText = extractionResponse.content[0].type === 'text'
      ? extractionResponse.content[0].text
      : '';

    let extractedData;
    try {
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7);
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3);
      }
      extractedData = JSON.parse(jsonText.trim());
    } catch {
      return res.status(500).json({
        error: 'Failed to parse extracted data',
        debug: responseText.substring(0, 500)
      });
    }

    // If company URL wasn't found, try to find it
    if (!extractedData.companyUrl && extractedData.companyName) {
      try {
        const searchResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          temperature: 0,
          messages: [{
            role: 'user',
            content: COMPANY_SEARCH_PROMPT.replace('{companyName}', extractedData.companyName),
          }],
        });

        const urlResponse = searchResponse.content[0].type === 'text'
          ? searchResponse.content[0].text.trim()
          : '';

        if (urlResponse && urlResponse !== 'null' && urlResponse.startsWith('http')) {
          extractedData.companyUrl = urlResponse;
        }
      } catch (error) {
        console.error('Company URL search failed:', error);
      }
    }

    if (!extractedData.jobTitle && !extractedData.jobDescription) {
      return res.status(400).json({
        error: 'Could not extract job information from this page. Please copy and paste the details manually.'
      });
    }

    return res.status(200).json(extractedData);
  } catch (error) {
    console.error('Scrape error:', error);

    if (error instanceof Error) {
      if (error.message.includes('HTTP 403') || error.message.includes('HTTP 401')) {
        return res.status(400).json({
          error: 'This website blocks automated access. Please copy and paste the job details manually.'
        });
      }
      if (error.message.includes('HTTP 404')) {
        return res.status(400).json({
          error: 'Page not found. Please check the URL and try again.'
        });
      }
    }

    return res.status(500).json({
      error: 'Failed to fetch job posting. Please try again or copy and paste the details manually.'
    });
  }
}

// ============ RESEARCH FUNCTIONALITY ============

async function queryPerplexity(
  query: string,
  systemPrompt: string,
  apiKey: string
): Promise<string> {
  const messages: PerplexityMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: query },
  ];

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-small-128k-online',
      messages,
      temperature: 0.2,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as PerplexityResponse;
  return data.choices[0]?.message?.content || '';
}

function parseJsonFromResponse(text: string): unknown {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1]);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}

async function handleResearch(req: VercelRequest, res: VercelResponse, companyName: string, industry?: string, companyUrl?: string) {
  const perplexityKey = process.env.PERPLEXITY_API_KEY;

  // If no Perplexity key, return empty research
  if (!perplexityKey) {
    console.log('No Perplexity API key configured, returning empty research');
    return res.status(200).json({
      companyResearch: null,
      industryAnalysis: null,
      competitiveLandscape: null,
      source: 'none',
    });
  }

  const systemPrompt = `You are a business research analyst. Provide factual, up-to-date information in JSON format.
Always structure your response as valid JSON matching the requested schema.
If you cannot find information for a field, use null instead of making assumptions.
Be concise but comprehensive.`;

  const [companyResult, industryResult, competitiveResult] = await Promise.all([
    queryPerplexity(
      `Research ${companyName}${companyUrl ? ` (${companyUrl})` : ''}.
Provide information in this JSON format:
{
  "mission": "company mission statement or purpose",
  "values": ["list", "of", "core", "values"],
  "culture": "description of company culture and work environment",
  "strategy": "current business strategy and direction",
  "recentNews": ["recent news item 1", "recent news item 2"],
  "keyPeople": [{"name": "CEO Name", "title": "CEO"}],
  "fundingStage": "funding stage if startup, or public/private status",
  "employeeCount": "approximate employee count",
  "founded": "year founded",
  "headquarters": "headquarters location"
}`,
      systemPrompt,
      perplexityKey
    ).catch(err => {
      console.error('Company research failed:', err);
      return null;
    }),

    queryPerplexity(
      `Analyze the ${industry || companyName + ' industry'} market in 2024-2025.
Provide information in this JSON format:
{
  "trends": ["trend 1", "trend 2", "trend 3"],
  "challenges": ["challenge 1", "challenge 2"],
  "regulations": ["relevant regulation or compliance requirement"],
  "outlook": "market outlook summary",
  "keyMetrics": ["important industry KPIs or metrics"]
}`,
      systemPrompt,
      perplexityKey
    ).catch(err => {
      console.error('Industry analysis failed:', err);
      return null;
    }),

    queryPerplexity(
      `Analyze the competitive landscape for ${companyName}.
Provide information in this JSON format:
{
  "competitors": [
    {"name": "Competitor 1", "description": "brief description", "differentiation": "how they differ"},
    {"name": "Competitor 2", "description": "brief description", "differentiation": "how they differ"}
  ],
  "marketPosition": "description of the company's market position",
  "competitiveAdvantages": ["advantage 1", "advantage 2"]
}`,
      systemPrompt,
      perplexityKey
    ).catch(err => {
      console.error('Competitive analysis failed:', err);
      return null;
    }),
  ]);

  const companyResearch = companyResult ? parseJsonFromResponse(companyResult) : null;
  const industryAnalysis = industryResult ? parseJsonFromResponse(industryResult) : null;
  const competitiveLandscape = competitiveResult ? parseJsonFromResponse(competitiveResult) : null;

  return res.status(200).json({
    companyResearch,
    industryAnalysis,
    competitiveLandscape,
    source: 'perplexity',
  });
}

// ============ MAIN HANDLER ============

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server configuration error: Missing database config' });
  }

  // Verify auth token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body as ResearchRequest;
    const { action = 'research', companyName, industry, companyUrl, url } = body;

    // Route to appropriate handler
    if (action === 'scrape') {
      if (!url) {
        return res.status(400).json({ error: 'URL is required for scrape action' });
      }
      return handleScrape(req, res, url);
    } else {
      if (!companyName) {
        return res.status(400).json({ error: 'Company name is required' });
      }
      return handleResearch(req, res, companyName, industry, companyUrl);
    }
  } catch (error) {
    console.error('Research API error:', error);
    const message = error instanceof Error ? error.message : 'Request failed';
    return res.status(500).json({ error: message });
  }
}
