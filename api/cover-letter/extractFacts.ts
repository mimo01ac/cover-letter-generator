import Anthropic from '@anthropic-ai/sdk';

interface DocumentInput {
  name: string;
  type: string;
  content: string;
}

interface ProfileInput {
  name: string;
  summary: string;
}

export interface ExtractedSkill {
  skill: string;
  source: string;
  context: string;
  confidence: 'explicit' | 'demonstrated' | 'mentioned';
}

export interface ExtractedAchievement {
  description: string;
  metrics?: string;
  source: string;
}

export interface ExtractedCredential {
  type: 'degree' | 'certification' | 'title';
  name: string;
  source: string;
}

export interface CandidateFactInventory {
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

export async function extractFacts(
  profile: ProfileInput,
  documents: DocumentInput[],
  anthropicKey: string
): Promise<CandidateFactInventory> {
  // Build document content for extraction
  let documentContent = '';

  if (profile?.summary?.trim()) {
    documentContent += `--- Professional Summary ---\n${profile.summary}\n\n`;
  }

  for (const doc of documents || []) {
    if (doc?.content?.trim()) {
      documentContent += `--- ${doc.name} (${doc.type}) ---\n${doc.content}\n\n`;
    }
  }

  // Return empty inventory if no content to extract from
  if (!documentContent.trim()) {
    console.log('No document content to extract facts from');
    return createEmptyInventory();
  }

  const anthropic = new Anthropic({
    apiKey: anthropicKey,
  });

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
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

  // Extract text content from response
  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    console.error('No text content in extraction response');
    return createEmptyInventory();
  }

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

    // Validate and sanitize the parsed data
    return sanitizeInventory(parsed);
  } catch (error) {
    console.error('Failed to parse extraction response:', error);
    console.error('Raw response:', textContent.text);
    return createEmptyInventory();
  }
}

function createEmptyInventory(): CandidateFactInventory {
  return {
    skills: [],
    achievements: [],
    credentials: [],
    companies: [],
  };
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

export function formatFactInventory(inventory: CandidateFactInventory): string {
  return JSON.stringify(inventory, null, 2);
}
