import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- Shared types ---

interface GenerationRequest {
  action: 'generate';
  profile: {
    name: string;
    email: string;
    phone: string;
    location: string;
    summary: string;
  };
  documents: Array<{
    name: string;
    type: string;
    content: string;
  }>;
  profileId: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  language?: 'en' | 'da';
  customNotes?: string;
  selectedTemplate?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RefinementRequest {
  action: 'refine';
  cvId: string;
  currentCVData: Record<string, unknown>;
  userRequest: string;
  conversationHistory: ChatMessage[];
  profile: {
    name: string;
    email: string;
    phone: string;
    location: string;
    summary: string;
  };
  documents: Array<{
    name: string;
    type: string;
    content: string;
  }>;
  jobDescription: string;
  language?: string;
}

// --- Fact extraction types ---

interface ExtractedSkill {
  skill: string;
  source: string;
  context: string;
  confidence: 'explicit' | 'demonstrated' | 'mentioned';
}

interface ExtractedAchievement {
  description: string;
  metrics?: string;
  source: string;
}

interface ExtractedCredential {
  type: 'degree' | 'certification' | 'title';
  name: string;
  source: string;
}

interface CandidateFactInventory {
  skills: ExtractedSkill[];
  achievements: ExtractedAchievement[];
  credentials: ExtractedCredential[];
  companies: string[];
}

// --- Prompts ---

const EXTRACTION_PROMPT = `You are a precise fact extractor. Extract ONLY verifiable facts from the candidate documents. Be conservative - if something isn't clearly stated, don't include it.

Analyze the provided documents and extract:

1. **Skills**: Technical and soft skills that are explicitly mentioned or clearly demonstrated
   - "explicit": skill is directly stated (e.g., "Proficient in Python")
   - "demonstrated": skill is shown through work (e.g., "Built REST APIs" demonstrates API design)
   - "mentioned": skill is referenced but not elaborated (e.g., "familiar with Docker")

2. **Achievements**: Accomplishments with specific outcomes
   - Include exact metrics if present (don't invent numbers)
   - Note the source document

3. **Credentials**: Degrees, certifications, and job titles
   - Only include if explicitly stated
   - Include the granting institution/company if mentioned

4. **Companies**: List of companies where the candidate has worked

Return a JSON object matching this exact structure:
{
  "skills": [
    {"skill": "string", "source": "document name", "context": "exact quote or paraphrase proving this skill", "confidence": "explicit|demonstrated|mentioned"}
  ],
  "achievements": [
    {"description": "what they achieved", "metrics": "exact numbers if present, otherwise omit", "source": "document name"}
  ],
  "credentials": [
    {"type": "degree|certification|title", "name": "credential name", "source": "document name"}
  ],
  "companies": ["company names"]
}

CRITICAL RULES:
- NEVER invent or infer skills not in the text
- NEVER fabricate metrics or numbers
- If a metric is vague ("improved performance"), do NOT add specific percentages
- For confidence levels, be conservative - use "mentioned" if unsure
- Include the surrounding context/proof for each skill
- Return valid JSON only, no additional text`;

const CV_SYSTEM_PROMPT = `You are an expert CV/resume writer. Your task is to take a candidate's existing experience and create a targeted, restructured CV tailored for a specific job opening.

### CRITICAL RULES - ANTI-HALLUCINATION
1. **NEVER invent experiences, skills, companies, or achievements** that are not in the source documents
2. **ALL experience entries must come from the candidate's actual work history** - same companies, same titles, same time periods
3. **You may REWRITE bullet points** to emphasize relevance to the target role, but the underlying facts must be real
4. **You may REORDER sections and entries** to highlight the most relevant experience first
5. **You may ADD core competencies/skills** ONLY if they appear in the fact inventory or documents
6. **ALL metrics must be verbatim** from the source documents - never invent numbers
7. **Include ALL work experience** from the documents - do not drop jobs, but you may give less relevant ones fewer bullets

### CONTENT RULES
- Achievement over responsibility: Never write "Responsible for X." Instead: "Delivered X, resulting in Y."
- Quantify everything possible: revenue, percentages, team sizes, time saved, efficiency gains
- Action verbs first: Every bullet starts with a strong action verb (Led, Delivered, Increased, Reduced, Developed, Implemented, Managed, Drove, Optimized)
- No personal pronouns: Never use "I," "me," or "my"
- No buzzwords without evidence: Do not say "results-driven" — show the results
- Past tense for previous roles, present tense for current role
- Match skills terminology exactly to the job description keywords

### TEMPLATE-SPECIFIC GUIDANCE

The selected template determines the tone and emphasis of your output:

**Classic Chronological** (template: "classic"):
- Best for steady career progression in one industry
- **executiveSummary**: 2-3 sentences. Opens with [Title] + years of experience + domain. Include 1-2 quantified achievements. Close with value proposition for the target role.
- **careerHighlights**: 3-5 most relevant achievements (can be brief if experience bullets are strong)
- **coreCompetencies**: 6-12 skills, mix of hard and soft skills with hard skills prioritized
- **experience**: 3-6 bullet points per role for recent/relevant roles, fewer for older. Focus on progressive achievements.
- **education**: Standard format with degree, institution, period

**Modern Hybrid** (template: "hybrid"):
- Best for career changers, diverse experience, freelancers, transferable skills
- **executiveSummary**: 2-4 sentences. Emphasize breadth of skills and adaptability. For career changers, explicitly connect previous experience to target role.
- **careerHighlights**: 3-5 cross-cutting achievements that span multiple roles (especially useful for consultants/freelancers)
- **coreCompetencies**: 9-15 skills — this is the KEY section. These function as ATS keywords. Mirror the job description language exactly.
- **experience**: 2-4 bullets per role (fewer than Classic since skills are established above). Frame achievements to reinforce the listed competencies.
- **education**: Include relevant continuing education, bootcamps, professional development

**Executive Impact** (template: "executive"):
- Best for VP/Director/C-suite, 15+ years of leadership, strategic/P&L roles
- **executiveSummary**: 3-5 sentences — MORE substantial than other templates. Paragraph-style elevator pitch. Must include: total years of executive experience, scope indicators (revenue, team size, geographic reach), 1-2 marquee achievements, forward-looking statement.
- **careerHighlights**: 4-6 bullets — the "greatest hits" across entire career. Each must include financial metrics, scale indicators, and transformation language. Format: Impact Statement + Context + Metric.
- **coreCompetencies**: 12-18 strategic/leadership competencies (Strategic Planning, P&L Management, M&A, Board Relations, Organizational Transformation, etc.)
- **experience**: For each role include context about strategic mandate. 3-5 achievement bullets with financial metrics, scale indicators, before-to-after comparisons. Include company descriptors for lesser-known companies.
- **education**: Concise. MBA/advanced degrees first. No dates if graduation was 15+ years ago.

### OUTPUT FORMAT
Return ONLY a valid JSON object matching this structure (no markdown, no explanation):
{
  "headline": "string",
  "executiveSummary": "string",
  "careerHighlights": ["string"],
  "coreCompetencies": ["string"],
  "experience": [
    {
      "company": "string",
      "title": "string",
      "period": "string",
      "location": "string (optional)",
      "bullets": ["string"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "period": "string",
      "details": "string (optional)"
    }
  ],
  "certifications": ["string (optional)"],
  "languages": ["string (optional)"]
}`;

// --- Helpers ---

function createEmptyInventory(): CandidateFactInventory {
  return {
    skills: [],
    achievements: [],
    credentials: [],
    companies: [],
  };
}

function validateConfidence(value: unknown): 'explicit' | 'demonstrated' | 'mentioned' {
  if (value === 'explicit' || value === 'demonstrated' || value === 'mentioned') {
    return value;
  }
  return 'mentioned';
}

function validateCredentialType(value: unknown): 'degree' | 'certification' | 'title' {
  if (value === 'degree' || value === 'certification' || value === 'title') {
    return value;
  }
  return 'title';
}

function sanitizeInventory(raw: unknown): CandidateFactInventory {
  const inventory = createEmptyInventory();

  if (!raw || typeof raw !== 'object') {
    return inventory;
  }

  const data = raw as Record<string, unknown>;

  if (Array.isArray(data.skills)) {
    inventory.skills = data.skills
      .filter((s): s is Record<string, unknown> =>
        s && typeof s === 'object' &&
        typeof (s as Record<string, unknown>).skill === 'string'
      )
      .map((s): ExtractedSkill => ({
        skill: String(s.skill),
        source: String(s.source || 'Unknown'),
        context: String(s.context || ''),
        confidence: validateConfidence(s.confidence),
      }));
  }

  if (Array.isArray(data.achievements)) {
    inventory.achievements = data.achievements
      .filter((a): a is Record<string, unknown> =>
        a && typeof a === 'object' &&
        typeof (a as Record<string, unknown>).description === 'string'
      )
      .map((a): ExtractedAchievement => {
        const achievement: ExtractedAchievement = {
          description: String(a.description),
          source: String(a.source || 'Unknown'),
        };
        if (a.metrics && typeof a.metrics === 'string' && a.metrics.trim()) {
          achievement.metrics = a.metrics;
        }
        return achievement;
      });
  }

  if (Array.isArray(data.credentials)) {
    inventory.credentials = data.credentials
      .filter((c): c is Record<string, unknown> =>
        c && typeof c === 'object' &&
        typeof (c as Record<string, unknown>).name === 'string'
      )
      .map((c): ExtractedCredential => ({
        type: validateCredentialType(c.type),
        name: String(c.name),
        source: String(c.source || 'Unknown'),
      }));
  }

  if (Array.isArray(data.companies)) {
    inventory.companies = data.companies
      .filter((c): c is string => typeof c === 'string')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
  }

  return inventory;
}

async function extractFacts(
  profile: { name: string; summary: string },
  documents: Array<{ name: string; type: string; content: string }>,
  anthropicKey: string
): Promise<CandidateFactInventory> {
  let documentContent = '';

  if (profile?.summary?.trim()) {
    documentContent += `--- Professional Summary ---\n${profile.summary}\n\n`;
  }

  for (const doc of documents || []) {
    if (doc?.content?.trim()) {
      documentContent += `--- ${doc.name} (${doc.type}) ---\n${doc.content}\n\n`;
    }
  }

  if (!documentContent.trim()) {
    return createEmptyInventory();
  }

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: `Extract facts from these candidate documents:\n\n${documentContent}`,
      },
    ],
    system: EXTRACTION_PROMPT,
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    return createEmptyInventory();
  }

  try {
    let jsonText = textContent.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const parsed = JSON.parse(jsonText);
    return sanitizeInventory(parsed);
  } catch (error) {
    console.error('Failed to parse extraction response:', error);
    return createEmptyInventory();
  }
}

function parseJsonResponse(text: string): unknown {
  let jsonText = text.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.slice(7);
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.slice(3);
  }
  if (jsonText.endsWith('```')) {
    jsonText = jsonText.slice(0, -3);
  }
  return JSON.parse(jsonText.trim());
}

function sendEvent(res: VercelResponse, type: string, data: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
}

// --- Generate handler ---

async function handleGenerate(req: VercelRequest, res: VercelResponse) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!anthropicKey) {
    return res.status(500).json({ error: 'Server configuration error: Missing API key' });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server configuration error: Missing database config' });
  }

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

    const body = req.body as GenerationRequest;
    const {
      profile,
      documents,
      profileId,
      jobTitle,
      companyName,
      jobDescription,
      language = 'en',
      customNotes,
      selectedTemplate = 'classic',
    } = body;

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Step 1: Save initial record
    sendEvent(res, 'status', { phase: 'saving', message: 'Initializing...' });

    const { data: cvRecord, error: insertError } = await (supabase
      .from('tailored_cvs') as ReturnType<typeof supabase.from>)
      .insert({
        profile_id: profileId,
        job_title: jobTitle,
        company_name: companyName || '',
        job_description: jobDescription,
        selected_template: selectedTemplate,
        cv_data: {},
        language,
        status: 'generating',
      } as Record<string, unknown>)
      .select('id')
      .single();

    if (insertError) {
      sendEvent(res, 'error', { message: `Failed to create CV record: ${insertError.message}` });
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const cvId = (cvRecord as { id: string }).id;
    sendEvent(res, 'cv_id', { id: cvId });

    // Step 2: Extract facts
    sendEvent(res, 'status', { phase: 'extracting', message: 'Analyzing your experience...' });

    let factInventory: CandidateFactInventory = createEmptyInventory();
    try {
      factInventory = await extractFacts(profile, documents, anthropicKey);
      console.log('CV Tailor - Fact extraction succeeded:', {
        skills: factInventory.skills.length,
        achievements: factInventory.achievements.length,
        credentials: factInventory.credentials.length,
        companies: factInventory.companies.length,
      });
    } catch (extractError) {
      console.error('CV Tailor - Fact extraction failed:', extractError);
    }

    // Step 3: Generate CV
    sendEvent(res, 'status', { phase: 'generating', message: 'Tailoring your CV...' });

    const languageInstruction = language === 'da'
      ? 'Write ALL CV content in Danish (Dansk).'
      : 'Write ALL CV content in English.';

    const resumeDocs = documents.filter(d => d.type === 'cv');
    const otherDocs = documents.filter(d => d.type !== 'cv');

    let documentContext = '';
    if (resumeDocs.length > 0) {
      documentContext += '<resume>\n' + resumeDocs.map(d => `--- ${d.name} ---\n${d.content}`).join('\n\n') + '\n</resume>\n\n';
    }
    if (otherDocs.length > 0) {
      documentContext += '<supporting_documents>\n' + otherDocs.map(d => `--- ${d.name} (${d.type}) ---\n${d.content}`).join('\n\n') + '\n</supporting_documents>\n\n';
    }

    const userMessage = `<job_description>
Job Title: ${jobTitle}
Company: ${companyName || 'Not specified'}

${jobDescription}
</job_description>

<fact_inventory>
${JSON.stringify(factInventory, null, 2)}
</fact_inventory>

<candidate_profile>
Name: ${profile.name}
Email: ${profile.email}
Phone: ${profile.phone}
Location: ${profile.location}
${profile.summary ? `\nProfessional Summary:\n${profile.summary}` : ''}

${documentContext}
</candidate_profile>

<instructions>
${languageInstruction}
${customNotes ? `\nAdditional notes: ${customNotes}` : ''}

Create a tailored CV using the **${selectedTemplate}** template for the ${jobTitle} role at ${companyName || 'the company'}. Follow the template-specific guidance in the system prompt for this template. Include ALL work experience from the documents. Rewrite bullet points to emphasize relevance to this specific role. Return ONLY valid JSON.
</instructions>`;

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      temperature: 0,
      system: CV_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in CV generation response');
    }

    const cvData = parseJsonResponse(textContent.text);

    const cvDataObj = cvData as Record<string, unknown>;
    if (!cvDataObj.headline || !cvDataObj.experience || !Array.isArray(cvDataObj.experience)) {
      throw new Error('Invalid CV data structure');
    }

    // Step 4: Save to database
    sendEvent(res, 'status', { phase: 'saving', message: 'Saving your tailored CV...' });

    await (supabase.from('tailored_cvs') as ReturnType<typeof supabase.from>)
      .update({
        cv_data: cvData,
        status: 'ready',
      } as Record<string, unknown>)
      .eq('id', cvId);

    sendEvent(res, 'cv_data', { data: cvData });
    sendEvent(res, 'status', { phase: 'done', message: 'CV tailored successfully!' });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('CV Tailor API error:', error);
    const message = error instanceof Error ? error.message : 'CV generation failed';

    if (!res.headersSent) {
      return res.status(500).json({ error: message });
    }

    res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

// --- Refine handler ---

async function handleRefine(req: VercelRequest, res: VercelResponse) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!anthropicKey || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body as RefinementRequest;
  const {
    cvId,
    currentCVData,
    userRequest,
    conversationHistory,
    profile,
    documents,
    jobDescription,
    language = 'en',
  } = body;

  const languageInstruction = language === 'da'
    ? 'Respond in Danish (Dansk).'
    : 'Respond in English.';

  const cvContent = documents
    .map((doc) => `### ${doc.name} (${doc.type})\n${doc.content}`)
    .join('\n\n');

  const system = `You are an expert CV editor helping to refine and improve a tailored CV. ${languageInstruction}

## Context
You are helping ${profile.name} refine their tailored CV.

## Candidate Documents
${cvContent || 'No documents provided'}

## Job Description
${jobDescription}

## Current CV Data (JSON)
${JSON.stringify(currentCVData, null, 2)}

## Instructions
- Make the requested changes to the CV data
- Return the COMPLETE updated CV data as a JSON object
- Maintain the same JSON structure (headline, executiveSummary, careerHighlights, coreCompetencies, experience, education, certifications, languages)
- NEVER invent new experiences or companies
- You may rewrite bullet points, reorder entries, adjust the summary, add/remove skills
- Return ONLY valid JSON, no markdown or explanation`;

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userRequest },
  ];

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      temperature: 0,
      system,
      messages,
    });

    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in refinement response');
    }

    const cvData = parseJsonResponse(textContent.text);

    // Update in database
    await (supabase.from('tailored_cvs') as ReturnType<typeof supabase.from>)
      .update({ cv_data: cvData } as Record<string, unknown>)
      .eq('id', cvId);

    return res.status(200).json({ cvData });
  } catch (error) {
    console.error('CV refinement error:', error);
    const message = error instanceof Error ? error.message : 'Refinement failed';
    return res.status(500).json({ error: message });
  }
}

// --- Main router ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = req.query.action as string;

  switch (action) {
    case 'generate':
      return handleGenerate(req, res);
    case 'refine':
      return handleRefine(req, res);
    default:
      return res.status(400).json({ error: 'Invalid action. Use ?action=generate or ?action=refine' });
  }
}
