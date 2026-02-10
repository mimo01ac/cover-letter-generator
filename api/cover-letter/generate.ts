import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface GenerationRequest {
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
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  language?: 'en' | 'da';
  customNotes?: string;
}

// Fact extraction types (inlined to avoid module resolution issues in Vercel)
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

const SUMMARY_SYSTEM_PROMPT = `You are an expert CV writer creating a targeted executive summary for a candidate's CV/resume.

Your output must include TWO parts:

## 1. PROFESSIONAL HEADLINE
A punchy, pipe-separated headline (2-4 segments) that captures the candidate's core expertise areas relevant to the target role.
Format: "Area of Expertise | Specialization | Key Strength"
Examples:
- "Executive Leader in Revenue Operations | CRM & AI Enablement | Commercial Excellence Across Global Markets"
- "Senior Software Engineer | Cloud Architecture & DevOps | Scalable Systems Design"
- "Marketing Director | Brand Strategy & Digital Transformation | B2B SaaS Growth"

## 2. EXECUTIVE SUMMARY
A concise 3-5 sentence summary (maximum 100 words) that:
- Focuses on 2-3 most relevant qualifications for THIS specific role
- Uses active voice and impactful language
- Includes quantifiable achievements when available
- Mirrors job description terminology naturally
- Avoids generic phrases like "results-driven professional", "dynamic leader", "passionate about"

The summary should be written in first person.

### OUTPUT FORMAT
Output the headline first on its own line, then a blank line, then the executive summary paragraph.

### DATA SOURCE HIERARCHY
1. **<fact_inventory>:** Pre-extracted verified facts. Use these first when available.
2. **<resume>:** The candidate's CV with work history, skills, and experience.
3. **<interview_transcripts>:** Authentic voice, anecdotes, and STAR examples.
4. **<supporting_experience>:** Additional context and achievements.

**If the fact inventory is empty or sparse:** Extract facts directly from the <resume>, <interview_transcripts>, and <supporting_experience> sections. Apply the same strict verification rules - only claim what is explicitly stated or clearly demonstrated in those documents.

STRICT RULES:
- Only claim skills/achievements that are verifiable from the provided documents
- No hallucinations or invented accomplishments
- Keep the summary under 100 words (headline is separate)
- Make it specific to the target role, not generic
- ALWAYS generate output if ANY source documents are provided`;

const SYSTEM_PROMPT = `You are an expert Executive Career Coach and Professional Copywriter. Your goal is to write a high-impact, authentic cover letter that connects a candidate's verified experience to a specific job opening.

### DATA SOURCE HIERARCHY (CRITICAL)
You have access to multiple data sources in the <candidate_profile>. Use them in this priority order:
1.  **<interview_transcripts>:** This is the "Gold Source." It contains the candidate's authentic voice, specific anecdotes, and deep context. ALWAYS look here first for "STAR" examples (Situation, Task, Action, Result) to include.
2.  **<professional_summary>:** Use this to understand their core value proposition and branding.
3.  **<resume> & <supporting_experience>:** Use these for dates, hard skills, and factual verification.

### VERIFIED FACT INVENTORY (PRIMARY REFERENCE)
The <fact_inventory> section contains pre-extracted, verified facts from the candidate's documents. When populated, this is your PRIMARY source for what claims you can make.

**If the fact inventory is empty or sparse:** Extract facts directly from the <resume>, <interview_transcripts>, and <supporting_experience> sections. Apply the same strict verification rules - only claim what is explicitly stated or clearly demonstrated in those documents.

### STRICT CLAIM RULES (CRITICAL - MUST FOLLOW)
1. **Every skill claim MUST be verifiable** - Use <fact_inventory> if populated, otherwise extract directly from the candidate documents (<resume>, <interview_transcripts>, <supporting_experience>). Never invent skills.
2. **If a job requirement has NO matching fact:**
   - Acknowledge honestly by focusing on related skills that ARE in inventory, OR
   - Reference a transferable skill that IS in inventory with honest framing
3. **NEVER use "extensive", "expert", "deep expertise", or similar superlatives** unless:
   - The inventory shows 3+ years of experience, OR
   - The confidence level is "explicit" with strong context
4. **ALL metrics (percentages, team sizes, revenue, etc.) must come VERBATIM from inventory**
   - If inventory says "improved performance" with no number, do NOT write "improved performance by 40%"
5. **NEVER claim degrees or certifications not in inventory credentials**

### SKILL MAPPING RULES
When the job asks for X, only claim Y if Y is explicitly in inventory:
- "Cloud Architecture" -> only if architect role/title exists OR explicit cloud architecture skill
- "Leadership" -> only if manager/lead title exists OR team size mentioned in achievements
- "5+ years X" -> only if dates in inventory support this duration
- "Expert in X" -> only if confidence is "explicit" with substantial context

### EXAMPLE OF CORRECT BEHAVIOR
JOB REQUIREMENT: "Expert in Kubernetes and container orchestration"
INVENTORY: {skill: "Docker", confidence: "demonstrated", context: "Built containerized applications"}
WRONG: "I have extensive Kubernetes expertise and deep container orchestration experience..."
RIGHT: "My containerization experience with Docker, demonstrated through building containerized applications, provides a foundation I'm eager to extend into Kubernetes..."

### CORE DIRECTIVES (STRICT ADHERENCE REQUIRED)

1.  **ABSOLUTE TRUTH (NO HALLUCINATIONS):**
    * You are STRICTLY FORBIDDEN from inventing experiences, skills, or degrees.
    * You must ONLY use facts present in the <fact_inventory> and supporting documents.
    * Cross-reference EVERY claim against the fact inventory before writing it.

2.  **ANTI-ROBOTIC TONE:**
    * Do NOT use clichéd AI openers like "I am writing to express my interest..." or "I was thrilled to learn..."
    * BANNED WORDS/PHRASES: "Delve," "tapestry," "testament," "unwavering," "dynamic landscape," "synergy," "cutting-edge" (unless technical).
    * Write in a confident, professional, but conversational human voice.

3.  **NO SALESY OR PRESUMPTUOUS LANGUAGE:**
    * NEVER use phrases like: "your search ends here," "I'm the right profile," "look no further," "I'm your ideal candidate," "perfect fit," "exactly what you're looking for."
    * Avoid self-congratulatory claims - let achievements speak for themselves.
    * Be confident but humble. Express genuine interest, not entitlement.
    * WRONG: "I am precisely the leader you need to transform your revenue operations."
    * RIGHT: "My experience scaling revenue operations at [Company] aligns well with this role's challenges."

4.  **NATURAL LANGUAGE - DON'T PARROT THE JOB DESCRIPTION:**
    * Do NOT copy phrases directly from the job posting. Paraphrase requirements naturally.
    * Reference job requirements conversationally, as if you understood them, not as if you're checking boxes.
    * WRONG: "You are seeking someone who can 'drive cross-functional alignment and optimize go-to-market efficiency.' I have done exactly that."
    * RIGHT: "Bringing different teams together around shared revenue goals has been central to my work—at [Company], this meant..."
    * The letter should feel like a genuine response, not a keyword-matching exercise.

5.  **THE "SHOW, DON'T TELL" STRATEGY:**
    * Instead of listing adjectives ("I am a strategic leader"), tell a micro-story from the <interview_transcripts> or <experience_docs> that *proves* it.
    * Quantify results ONLY when exact numbers are available in the fact inventory.

### WRITING STRUCTURE
1.  **The Hook:** A strong, direct opening connecting the candidate's specific background to the company's challenges. Avoid grandiose claims.
2.  **The Evidence (Body):** 2-3 paragraphs mapping the candidate's *proven* achievements to the role's needs. Reference job requirements naturally, not verbatim.
3.  **The Close:** A professional, straightforward close expressing interest in discussing further. Avoid presumptuous lines like "I look forward to joining your team" or "I know I'm the right choice."

### FINAL CHECKS
* Return *only* the body of the letter.
* Ensure the tone matches the seniority implied in the <professional_summary>.
* If the user provided specific requests in <user_instructions>, those override standard style guidelines.
* VERIFY: Every skill/achievement claim traces back to the fact inventory OR the source documents.
* NEVER explain that the fact inventory is empty or discuss the data format - just write the cover letter using whatever candidate information is available.`;

// Helper functions for fact extraction (inlined)
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

  // Sanitize skills
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

  // Sanitize achievements
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

  // Sanitize credentials
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

  // Sanitize companies
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
  // Build document content for extraction
  let documentContent = '';

  console.log('extractFacts called with:', {
    profileName: profile?.name,
    profileSummaryLength: profile?.summary?.length || 0,
    documentsCount: documents?.length || 0,
    documentDetails: documents?.map(d => ({
      name: d?.name,
      type: d?.type,
      contentLength: d?.content?.length || 0,
      hasContent: !!d?.content?.trim(),
    })),
  });

  if (profile?.summary?.trim()) {
    documentContent += `--- Professional Summary ---\n${profile.summary}\n\n`;
  }

  for (const doc of documents || []) {
    if (doc?.content?.trim()) {
      documentContent += `--- ${doc.name} (${doc.type}) ---\n${doc.content}\n\n`;
    }
  }

  console.log('Document content built, total length:', documentContent.length);

  // Return empty inventory if no content to extract from
  if (!documentContent.trim()) {
    console.log('No document content to extract facts from');
    return createEmptyInventory();
  }

  const anthropic = new Anthropic({
    apiKey: anthropicKey,
  });

  console.log('Calling Haiku for fact extraction...');

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

  console.log('Haiku response received, content blocks:', response.content.length);

  // Extract text content from response
  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    console.error('No text content in extraction response');
    return createEmptyInventory();
  }

  console.log('Extraction response length:', textContent.text.length);

  try {
    // Parse JSON from response, handling potential markdown code blocks
    let jsonText = textContent.text.trim();

    // Remove markdown code block if present
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
    const sanitized = sanitizeInventory(parsed);

    console.log('Extraction parsed successfully:', {
      skills: sanitized.skills.length,
      achievements: sanitized.achievements.length,
      credentials: sanitized.credentials.length,
      companies: sanitized.companies.length,
    });

    return sanitized;
  } catch (error) {
    console.error('Failed to parse extraction response:', error);
    console.error('Raw response:', textContent.text.substring(0, 500));
    return createEmptyInventory();
  }
}

function formatFactInventory(inventory: CandidateFactInventory): string {
  return JSON.stringify(inventory, null, 2);
}

function buildUserMessage(
  profile: GenerationRequest['profile'],
  documents: GenerationRequest['documents'],
  jobTitle: string,
  companyName: string,
  jobDescription: string,
  language: 'en' | 'da',
  factInventory: CandidateFactInventory,
  customNotes?: string
): string {
  // Categorize documents by type
  const resumeDocs = documents.filter(d => d.type === 'cv');
  const interviewDocs = documents.filter(d =>
    d.type === 'experience' && d.name.toLowerCase().includes('interview')
  );
  const supportingDocs = documents.filter(d =>
    d.type === 'experience' && !d.name.toLowerCase().includes('interview')
  );
  const otherDocs = documents.filter(d => d.type === 'other');

  // Build XML structure
  let message = '';

  // Job Description (always present)
  message += `<job_description>\nJob Title: ${jobTitle}\nCompany: ${companyName || 'Not specified'}\n\n${jobDescription}\n</job_description>\n\n`;

  // Fact Inventory (verified facts from documents)
  message += `<fact_inventory>\n${formatFactInventory(factInventory)}\n</fact_inventory>\n\n`;

  // Candidate Profile
  message += '<candidate_profile>\n';

  // Professional Summary (from profile)
  if (profile.summary?.trim()) {
    message += `    <professional_summary>\nName: ${profile.name}\nLocation: ${profile.location}\n\n${profile.summary}\n    </professional_summary>\n\n`;
  }

  // Resume/CV documents
  if (resumeDocs.length > 0) {
    const resumeContent = resumeDocs
      .map(doc => `--- ${doc.name} ---\n${doc.content}`)
      .join('\n\n');
    message += `    <resume>\n${resumeContent}\n    </resume>\n\n`;
  }

  // Interview Transcripts (Gold Source)
  if (interviewDocs.length > 0) {
    const interviewContent = interviewDocs
      .map(doc => `--- ${doc.name} ---\n${doc.content}`)
      .join('\n\n');
    message += `    <interview_transcripts>\n${interviewContent}\n    </interview_transcripts>\n\n`;
  }

  // Supporting Experience documents
  const allSupportingDocs = [...supportingDocs, ...otherDocs];
  if (allSupportingDocs.length > 0) {
    const supportingContent = allSupportingDocs
      .map(doc => `--- ${doc.name} ---\n${doc.content}`)
      .join('\n\n');
    message += `    <supporting_experience>\n${supportingContent}\n    </supporting_experience>\n\n`;
  }

  message += '</candidate_profile>\n\n';

  // User Instructions (custom notes + language)
  const languageInstruction = language === 'da'
    ? 'Write the cover letter in Danish (Dansk).'
    : 'Write the cover letter in English.';

  const instructions = [languageInstruction];
  if (customNotes?.trim()) {
    instructions.push(customNotes.trim());
  }

  message += `<user_instructions>\n${instructions.join('\n')}\n</user_instructions>\n\n`;

  // Task
  message += `<task>\nWrite a cover letter for the role in <job_description> using the facts from <candidate_profile>.\nFollow the specific guidance in <user_instructions>.\n</task>`;

  return message;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check required environment variables (support both VITE_ prefixed and non-prefixed)
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!anthropicKey) {
    console.error('Missing ANTHROPIC_API_KEY environment variable');
    return res.status(500).json({ error: 'Server configuration error: Missing API key' });
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    return res.status(500).json({ error: 'Server configuration error: Missing database config' });
  }

  // Verify auth token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);

  try {
    const supabase = createClient(
      supabaseUrl,
      supabaseKey,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = req.body as GenerationRequest;
    const { profile, documents, jobTitle, companyName, jobDescription, language = 'en', customNotes } = body;

    // Extract verified facts from candidate documents using Haiku (fast, cheap)
    // Wrapped in try-catch to fail gracefully if extraction fails
    let factInventory: CandidateFactInventory = createEmptyInventory();
    let extractionDebug = {
      documentsReceived: documents?.length || 0,
      documentsWithContent: documents?.filter(d => d?.content?.trim()).length || 0,
      profileHasSummary: !!profile?.summary?.trim(),
    };

    try {
      console.log('Fact extraction debug:', extractionDebug);
      factInventory = await extractFacts(profile, documents, anthropicKey);
      console.log('Fact extraction succeeded:', {
        skills: factInventory.skills.length,
        achievements: factInventory.achievements.length,
        credentials: factInventory.credentials.length,
        companies: factInventory.companies.length,
      });
    } catch (extractError) {
      console.error('Fact extraction failed:', extractError);
      console.error('Extraction debug info:', extractionDebug);
      // Continue with empty inventory - generation will still work
    }

    const anthropic = new Anthropic({
      apiKey: anthropicKey,
    });

    const userMessage = buildUserMessage(
      profile,
      documents,
      jobTitle,
      companyName,
      jobDescription,
      language,
      factInventory,
      customNotes
    );

    // Set up streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream cover letter first
    const coverLetterStream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      temperature: 0.35, // Low temperature for factual accuracy, some creativity in phrasing
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    let fullCoverLetter = '';
    for await (const event of coverLetterStream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullCoverLetter += event.delta.text;
        res.write(`data: ${JSON.stringify({ type: 'cover_letter', text: event.delta.text })}\n\n`);
      }
    }

    // Signal cover letter complete
    res.write(`data: ${JSON.stringify({ type: 'cover_letter_done' })}\n\n`);

    // Now generate executive summary
    // Categorize documents for the summary (same as cover letter)
    const resumeDocs = documents.filter(d => d.type === 'cv');
    const interviewDocs = documents.filter(d =>
      d.type === 'experience' && d.name.toLowerCase().includes('interview')
    );
    const supportingDocs = documents.filter(d =>
      d.type === 'experience' && !d.name.toLowerCase().includes('interview')
    );
    const otherDocs = documents.filter(d => d.type === 'other');

    let summaryUserMessage = `<job_description>
Job Title: ${jobTitle}
Company: ${companyName || 'Not specified'}

${jobDescription}
</job_description>

<fact_inventory>
${formatFactInventory(factInventory)}
</fact_inventory>

<candidate_profile>
Name: ${profile.name}
${profile.summary ? `\nProfessional Summary:\n${profile.summary}` : ''}
`;

    // Include resume/CV documents
    if (resumeDocs.length > 0) {
      const resumeContent = resumeDocs
        .map(doc => `--- ${doc.name} ---\n${doc.content}`)
        .join('\n\n');
      summaryUserMessage += `\n<resume>\n${resumeContent}\n</resume>\n`;
    }

    // Include interview transcripts
    if (interviewDocs.length > 0) {
      const interviewContent = interviewDocs
        .map(doc => `--- ${doc.name} ---\n${doc.content}`)
        .join('\n\n');
      summaryUserMessage += `\n<interview_transcripts>\n${interviewContent}\n</interview_transcripts>\n`;
    }

    // Include supporting experience
    const allSupportingDocs = [...supportingDocs, ...otherDocs];
    if (allSupportingDocs.length > 0) {
      const supportingContent = allSupportingDocs
        .map(doc => `--- ${doc.name} ---\n${doc.content}`)
        .join('\n\n');
      summaryUserMessage += `\n<supporting_experience>\n${supportingContent}\n</supporting_experience>\n`;
    }

    summaryUserMessage += `</candidate_profile>

Write a targeted executive summary for this candidate's CV, tailored for the ${jobTitle} role.`;

    const summaryStream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      temperature: 0.3,
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: summaryUserMessage }],
    });

    for await (const event of summaryStream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ type: 'summary', text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('API error:', error);
    const message = error instanceof Error ? error.message : 'Generation failed';

    // If headers haven't been sent yet, return JSON error
    if (!res.headersSent) {
      return res.status(500).json({ error: message });
    }

    // Otherwise send error through stream
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
}
