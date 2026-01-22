import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractFacts, formatFactInventory, type CandidateFactInventory } from './extractFacts';

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

const SYSTEM_PROMPT = `You are an expert Executive Career Coach and Professional Copywriter. Your goal is to write a high-impact, authentic cover letter that connects a candidate's verified experience to a specific job opening.

### DATA SOURCE HIERARCHY (CRITICAL)
You have access to multiple data sources in the <candidate_profile>. Use them in this priority order:
1.  **<interview_transcripts>:** This is the "Gold Source." It contains the candidate's authentic voice, specific anecdotes, and deep context. ALWAYS look here first for "STAR" examples (Situation, Task, Action, Result) to include.
2.  **<professional_summary>:** Use this to understand their core value proposition and branding.
3.  **<resume> & <supporting_experience>:** Use these for dates, hard skills, and factual verification.

### VERIFIED FACT INVENTORY (MANDATORY REFERENCE)
The <fact_inventory> section contains pre-extracted, verified facts from the candidate's documents. This is your AUTHORITATIVE source for what claims you can make.

### STRICT CLAIM RULES (CRITICAL - MUST FOLLOW)
1. **Every skill claim MUST exist in <fact_inventory>** - Do not claim skills not listed there
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
    * BANNED WORDS: "Delve," "tapestry," "testament," "unwavering," "dynamic landscape," "synergy," "cutting-edge" (unless in a technical context).
    * Write in a confident, professional, but conversational human voice.

3.  **THE "SHOW, DON'T TELL" STRATEGY:**
    * Instead of listing adjectives ("I am a strategic leader"), tell a micro-story from the <interview_transcripts> or <experience_docs> that *proves* it.
    * Quantify results ONLY when exact numbers are available in the fact inventory.

### WRITING STRUCTURE
1.  **The Hook:** A strong, direct opening connecting the candidate's specific background to the company's immediate challenges.
2.  **The Evidence (Body):** 2-3 paragraphs mapping the candidate's *proven* achievements (from fact inventory) to the requirements in the <job_description>.
3.  **The Close:** A confident call to action (e.g., requesting an interview).

### FINAL CHECKS
* Return *only* the body of the letter.
* Ensure the tone matches the seniority implied in the <professional_summary>.
* If the user provided specific requests in <user_instructions>, those override standard style guidelines.
* VERIFY: Every skill/achievement claim traces back to the fact inventory.`;

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
    const factInventory = await extractFacts(profile, documents, anthropicKey);

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

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.35, // Low temperature for factual accuracy, some creativity in phrasing
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
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
