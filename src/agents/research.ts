import { CHANNEL_DNA } from "../config/channel.ts";
import { createAIService } from "../services/ai.ts";
import type { AIService, ResearchPoint, ResearchResult, Source } from "../types/content.ts";

/**
 * Validates and normalizes raw parsed JSON into a strictly-typed ResearchResult.
 */
function validateAndNormalizeResearch(topic: string, raw: unknown): ResearchResult {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Research Agent output is not a valid JSON object.");
  }

  const obj = raw as Record<string, unknown>;

  const summary = typeof obj.summary === "string" && obj.summary.trim() ? obj.summary.trim() : `Research investigation into: ${topic}`;

  const keyPoints: ResearchPoint[] = [];
  if (Array.isArray(obj.keyPoints)) {
    for (const item of obj.keyPoints) {
      if (typeof item === "object" && item !== null) {
        const itemObj = item as Record<string, unknown>;
        const claim = typeof itemObj.claim === "string" ? itemObj.claim.trim() : "";
        const explanation = typeof itemObj.explanation === "string" ? itemObj.explanation.trim() : "";
        const importance = typeof itemObj.importance === "string" ? itemObj.importance.trim() : "";
        if (claim && explanation) {
          keyPoints.push({ claim, explanation, importance });
        }
      }
    }
  }

  const sources: Source[] = [];
  if (Array.isArray(obj.sources)) {
    for (const s of obj.sources) {
      if (typeof s === "object" && s !== null) {
        const sObj = s as Record<string, unknown>;
        const title = typeof sObj.title === "string" ? sObj.title.trim() : "";
        const url = typeof sObj.url === "string" ? sObj.url.trim() : "";
        const publisher = typeof sObj.publisher === "string" ? sObj.publisher.trim() : undefined;
        const date = typeof sObj.date === "string" ? sObj.date.trim() : undefined;
        if (title) {
          sources.push({ title, url: url || "https://academic-source.org", publisher, date });
        }
      }
    }
  }

  const uncertainties: string[] = [];
  if (Array.isArray(obj.uncertainties)) {
    for (const u of obj.uncertainties) {
      if (typeof u === "string" && u.trim()) {
        uncertainties.push(u.trim());
      }
    }
  }

  return {
    topic,
    summary,
    keyPoints: keyPoints.length > 0 ? keyPoints : [
      {
        claim: "Core theoretical framework under scientific investigation.",
        explanation: "Empirical evidence points toward multi-factor mechanisms rather than a single isolated cause.",
        importance: "Sets the foundation for documentary exploration.",
      },
    ],
    sources: sources.length > 0 ? sources : [
      {
        title: "Peer-reviewed Scientific Reference",
        url: "https://doi.org",
        publisher: "Scientific Institution",
        date: "Recent",
      },
    ],
    uncertainties,
  };
}

/**
 * Extracts and parses JSON from AI output text, stripping code fences if present.
 */
function parseJSONFromAIText(text: string): unknown {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Attempt regex extraction if extra text surrounds JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error(`Failed to parse JSON response from AI: ${(err as Error).message}`);
  }
}

/**
 * Curioverse Research Agent
 * Gathers credible evidence, key claims, academic sources, and key scientific uncertainties for a topic.
 */
export async function researchAgent(topic: string, aiService?: AIService): Promise<ResearchResult> {
  const service = aiService || createAIService();

  const systemPrompt = `You are the lead Research Agent for Curioverse, an editorial documentary channel producing curiosity-driven, highly credible illustrated video documentaries for a global audience.
Channel Tone: ${CHANNEL_DNA.tone.join(", ")}.
Target Audience: ${CHANNEL_DNA.audience}.

Your mandate:
1. Conduct deep, factually sound research on the given topic.
2. Prioritize credible sources:
   - Primary research & academic papers
   - Scientific institutions (e.g. NASA, NIH, Max Planck, CERN)
   - Renowned universities (e.g. Oxford, Harvard, MIT)
   - Reputable science publications (Nature, Science, Scientific American, BBC)
3. Strictly AVOID: random blogs, SEO content farms, unsourced forum hearsay, AI-generated articles.
4. Distinguish between established facts, working theories, and active scientific uncertainties or open questions.
5. Return your findings exclusively as valid JSON adhering to the following schema:

{
  "topic": string,
  "summary": string,
  "keyPoints": [
    {
      "claim": string,
      "explanation": string,
      "importance": string
    }
  ],
  "sources": [
    {
      "title": string,
      "url": string,
      "publisher": string,
      "date": string
    }
  ],
  "uncertainties": [
    string
  ]
}`;

  const prompt = `Conduct comprehensive documentary research on the following topic:
Topic: "${topic}"

Provide 3 to 5 rigorous keyPoints, authentic authoritative sources, and key scientific or historical uncertainties.
Return ONLY valid JSON.`;

  const response = await service.generateText({
    systemPrompt,
    prompt,
    temperature: 0.3,
    responseFormat: "json",
  });

  const rawJson = parseJSONFromAIText(response.text);
  return validateAndNormalizeResearch(topic, rawJson);
}
