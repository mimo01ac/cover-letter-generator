import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ProcessTranscriptRequest {
  transcript: string;
  profileName: string;
  mode?: 'career-interview' | 'mock-interview' | 'case-interview';
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check required environment variables (support both VITE_ prefixed and non-prefixed)
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!anthropicKey || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Verify auth token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);

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

  const body = req.body as ProcessTranscriptRequest;
  const { transcript, profileName, mode = 'career-interview', jobTitle, companyName, jobDescription } = body;

  const anthropic = new Anthropic({
    apiKey: anthropicKey,
  });

  try {
    if (mode === 'case-interview') {
      // Generate structured case interview feedback
      const feedbackResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: `You are a senior executive coach evaluating a candidate's performance in a strategic case presentation. The candidate received a pre-read case brief in advance and is presenting their strategic plan — similar to a new CCO presenting their 90-day turnaround plan to the board.

This is NOT a traditional consulting case interview. Evaluate them as a senior executive would: on strategic clarity, leadership thinking, prioritization, stakeholder awareness, and ability to handle pushback.

## Case Brief (what the candidate was given in advance)
${jobDescription || 'Not provided'}

## Interview Transcript
${transcript}

Provide feedback in the following JSON format. Score each item from 1-10. Be honest, specific, and constructive. Evaluate like a hiring panel of senior executives.

\`\`\`json
{
  "overallScore": <1-10>,
  "categoryScores": [
    { "category": "Problem Structuring", "score": <1-10>, "comment": "<feedback on strategic clarity, prioritization, logical sequencing of their plan>" },
    { "category": "Quantitative Skills", "score": <1-10>, "comment": "<feedback on use of data, metrics, targets, and benchmarks to support their strategy>" },
    { "category": "Business Judgment", "score": <1-10>, "comment": "<feedback on commercial realism, stakeholder awareness, execution feasibility, risk assessment>" },
    { "category": "Communication", "score": <1-10>, "comment": "<feedback on executive presence, narrative flow, confidence, ability to be concise>" },
    { "category": "Synthesis & Recommendation", "score": <1-10>, "comment": "<feedback on quality of final recommendation, board-readiness, adaptability when challenged>" }
  ],
  "structureAnalysis": {
    "framework": "<the strategic framework or approach the candidate used>",
    "meceScore": <1-10>,
    "comment": "<feedback on how well-structured and comprehensive their strategic plan was>"
  },
  "communicationAnalysis": {
    "clarity": <1-10>,
    "topDown": <1-10>,
    "signposting": <1-10>,
    "comment": "<feedback on executive communication style — did they lead with the headline? Were transitions clear?>"
  },
  "quantitativeAnalysis": {
    "mathAccuracy": <1-10>,
    "structuredApproach": <1-10>,
    "comment": "<feedback on how they used data and metrics to support their strategy — not math-for-math's-sake>"
  },
  "synthesisFeedback": {
    "actionable": <1-10>,
    "supported": <1-10>,
    "concise": <1-10>,
    "comment": "<feedback on their final recommendation — would the board approve this?>"
  },
  "strengths": ["<strength 1>", "<strength 2>"],
  "areasForImprovement": ["<area 1>", "<area 2>"],
  "actionItems": ["<specific practice recommendation 1>", "<specific recommendation 2>"]
}
\`\`\`

Return ONLY the JSON, no other text.`
        }],
      });

      const feedbackText = feedbackResponse.content[0].type === 'text' ? feedbackResponse.content[0].text : '';
      const jsonMatch = feedbackText.match(/```json\s*([\s\S]*?)```/) || feedbackText.match(/```\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : feedbackText.trim();
      const feedback = JSON.parse(jsonStr);

      return res.status(200).json({ feedback });
    }

    if (mode === 'mock-interview') {
      // Generate structured mock interview feedback
      const feedbackResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: `You are an expert interview coach. Analyze this mock interview transcript where the candidate was interviewed for the role of "${jobTitle || 'Unknown Role'}" at "${companyName || 'Unknown Company'}".

## Job Description
${jobDescription || 'Not provided'}

## Interview Transcript
${transcript}

Provide detailed feedback in the following JSON format. Be honest but constructive. Score each item from 1-10.

\`\`\`json
{
  "overallScore": <1-10>,
  "categoryScores": [
    { "category": "Communication", "score": <1-10>, "comment": "<specific feedback on clarity, articulation, confidence>" },
    { "category": "Technical", "score": <1-10>, "comment": "<feedback on technical knowledge demonstration>" },
    { "category": "Cultural Fit", "score": <1-10>, "comment": "<feedback on alignment with company values/culture>" },
    { "category": "Problem-Solving", "score": <1-10>, "comment": "<feedback on analytical thinking and structured responses>" },
    { "category": "Pressure Handling", "score": <1-10>, "comment": "<feedback on composure under challenging questions>" }
  ],
  "questionFeedback": [
    {
      "question": "<the question that was asked>",
      "candidateResponse": "<brief summary of what they said>",
      "score": <1-10>,
      "whatWentWell": "<positive aspects>",
      "whatToImprove": "<areas for improvement>",
      "suggestedBetterAnswer": "<a stronger version of their answer>"
    }
  ],
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "areasForImprovement": ["<area 1>", "<area 2>", ...],
  "actionItems": ["<specific action 1>", "<specific action 2>", ...]
}
\`\`\`

Return ONLY the JSON, no other text.`
        }],
      });

      const feedbackText = feedbackResponse.content[0].type === 'text' ? feedbackResponse.content[0].text : '';

      // Parse JSON from response (handle markdown code fences)
      const jsonMatch = feedbackText.match(/```json\s*([\s\S]*?)```/) || feedbackText.match(/```\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : feedbackText.trim();
      const feedback = JSON.parse(jsonStr);

      return res.status(200).json({ feedback });
    }

    // Original career-interview flow
    const insightsResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Analyze this interview transcript and extract key insights that will help create better cover letters for ${profileName}.

## Transcript
${transcript}

Create a comprehensive summary with:

1. **Key Achievements** - Specific accomplishments with metrics/results mentioned
2. **Unique Stories** - Memorable examples and anecdotes that stand out
3. **Skills Demonstrated** - Technical and soft skills with real examples
4. **Work Style** - How they approach problems, collaborate, lead
5. **Motivations** - What drives them, career goals, ideal work environment
6. **Standout Qualities** - What makes them unique as a candidate

Format the output as a detailed document that can be used as reference when writing cover letters. Include direct quotes where impactful.`
      }],
    });

    const insights = insightsResponse.content[0].type === 'text' ? insightsResponse.content[0].text : '';

    // Generate brief summary
    const summaryResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Summarize this in 2-3 sentences - what are the most important things learned about this candidate?\n\n${insights}`
      }],
    });

    const summary = summaryResponse.content[0].type === 'text' ? summaryResponse.content[0].text : '';

    return res.status(200).json({ summary, insights });
  } catch (error) {
    console.error('Claude API error:', error);
    return res.status(500).json({ error: 'Failed to process transcript' });
  }
}
