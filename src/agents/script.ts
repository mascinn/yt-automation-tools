import { CHANNEL_DNA } from "../config/channel.ts";
import { createAIService } from "../services/ai.ts";
import type { AIService, FactCheckResult, ResearchResult, ScriptSection, VideoScript } from "../types/content.ts";

/**
 * Calculates estimated spoken duration in seconds based on word count.
 * Natural documentary narration pace is ~135 words per minute (~2.25 words per second).
 */
function estimateSpokenDurationSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return Math.max(5, Math.round(words / 2.25));
}

/**
 * Validates and normalizes raw parsed JSON into a strictly-typed VideoScript.
 */
function validateAndNormalizeScript(research: ResearchResult, raw: unknown): VideoScript {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Script Agent output is not a valid JSON object.");
  }

  const obj = raw as Record<string, unknown>;

  const title = typeof obj.title === "string" && obj.title.trim()
    ? obj.title.trim()
    : `The Mystery of ${research.topic}`;

  const hook = typeof obj.hook === "string" && obj.hook.trim()
    ? obj.hook.trim()
    : `Consider what happens when we look closely at ${research.topic}.`;

  const closing = typeof obj.closing === "string" && obj.closing.trim()
    ? obj.closing.trim()
    : "Thank you for watching Curioverse. Keep questioning the everyday world.";

  const sections: ScriptSection[] = [];
  if (Array.isArray(obj.sections)) {
    for (let i = 0; i < obj.sections.length; i++) {
      const s = obj.sections[i];
      if (typeof s === "object" && s !== null) {
        const sObj = s as Record<string, unknown>;
        const id = typeof sObj.id === "string" && sObj.id.trim() ? sObj.id.trim() : `sec-${String(i + 1).padStart(2, "0")}`;
        const purpose = typeof sObj.purpose === "string" && sObj.purpose.trim() ? sObj.purpose.trim() : "EXPLANATION";
        const narration = typeof sObj.narration === "string" ? sObj.narration.trim() : "";
        if (narration) {
          const estimatedDuration = typeof sObj.estimatedDuration === "number" && sObj.estimatedDuration > 0
            ? Math.round(sObj.estimatedDuration)
            : estimateSpokenDurationSeconds(narration);
          sections.push({ id, purpose, narration, estimatedDuration });
        }
      }
    }
  }

  // If no sections were parsed, generate a baseline structured section set
  if (sections.length === 0) {
    sections.push({
      id: "sec-01-hook",
      purpose: "HOOK",
      narration: hook,
      estimatedDuration: estimateSpokenDurationSeconds(hook),
    });
    sections.push({
      id: "sec-02-explanation",
      purpose: "EXPLANATION",
      narration: research.summary,
      estimatedDuration: estimateSpokenDurationSeconds(research.summary),
    });
  }

  const totalDuration = sections.reduce((acc, s) => acc + s.estimatedDuration, 0);

  return {
    title,
    hook,
    sections,
    estimatedDuration: totalDuration,
    closing,
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
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error(`Failed to parse JSON script response from AI: ${(err as Error).message}`);
  }
}

/**
 * Curioverse Script Agent
 * Transforms structured research and fact-check findings into an immersive, narrated documentary script.
 * Enforces the 8-stage storytelling arc and eliminates AI cliches.
 */
export async function scriptAgent(
  research: ResearchResult,
  factCheck?: FactCheckResult,
  aiService?: AIService
): Promise<VideoScript> {
  const service = aiService || createAIService();

  const storytellingArc = CHANNEL_DNA.storytellingPrinciples.join(" → ");

  const systemPrompt = `You are the lead Script Agent for Curioverse, an editorial illustrated documentary channel.
Channel Tone: ${CHANNEL_DNA.tone.join(", ")}.
Audience: ${CHANNEL_DNA.audience}.

Your script must follow the Curioverse Storytelling Arc:
${storytellingArc}

Rules for Narration:
1. Write for spoken English audio narration. Every sentence must sound natural and rhythmic when read aloud.
2. Structure sections according to the arc:
   - HOOK: Gripping cinematic entry point, concrete sensory observation.
   - QUESTION: The central curiosity puzzle that frames the inquiry ("Wait... why is that?").
   - CONTEXT: Historical or common assumption before modern understanding.
   - DISCOVERY: The turning point or empirical breakthrough.
   - EXPLANATION: How the underlying mechanism or science functions in clear, vivid language.
   - COMPLICATION: A surprising twist, paradox, or unanswered scientific question.
   - PAYOFF: The deeper meaning or synthesis that resolves the core mystery.
   - REFLECTION: A poetic, resonant closing thought that stays with the viewer.
3. Factual Integrity & Epistemic Honesty:
   - Never present speculation or hypotheses as settled facts.
   - Respect the Fact Checker's flagged claims and qualifying guidance.
4. Strictly AVOID the following cliches:
   - "Hello guys, welcome back" or any YouTube greeting
   - Fake suspense or melodramatic hyperbole
   - Excessive rhetorical questions
   - Repetitive transitional phrases like "but here's the thing" or "in a world where"
   - AI clichés ("delve", "testament", "tapestry", "beacon")
   - Exaggerated certainty or unsupported speculation
5. Output format must be strictly valid JSON conforming to:

{
  "title": string,
  "hook": string,
  "sections": [
    {
      "id": string,
      "purpose": "HOOK" | "QUESTION" | "CONTEXT" | "DISCOVERY" | "EXPLANATION" | "COMPLICATION" | "PAYOFF" | "REFLECTION",
      "narration": string,
      "estimatedDuration": number // in seconds
    }
  ],
  "estimatedDuration": number,
  "closing": string
}`;

  let prompt = `Write a documentary script based on the following verified research:
Topic: "${research.topic}"
Summary: ${research.summary}

Key Points:
${research.keyPoints.map((kp, idx) => `${idx + 1}. [${kp.claim}] - ${kp.explanation}`).join("\n")}

Uncertainties / Open Questions:
${research.uncertainties.map((u, idx) => `${idx + 1}. ${u}`).join("\n")}`;

  if (factCheck) {
    prompt += `\n\nFact-Checker Epistemic Statuses:
${factCheck.claims.map((c) => `- [${c.status}] ${c.text} (Confidence: ${c.confidence})`).join("\n")}`;

    if (factCheck.flaggedClaims.length > 0) {
      prompt += `\n\nFlagged Claims (Must follow guidance):
${factCheck.flaggedClaims.map((fc) => `- Claim: "${fc.claim}"\n  Guidance: ${fc.guidanceForScript}`).join("\n")}`;
    }
  }

  prompt += `\n\nFollow the storytelling arc diligently. Return ONLY valid JSON.`;

  const response = await service.generateText({
    systemPrompt,
    prompt,
    temperature: 0.7,
    responseFormat: "json",
  });

  const rawJson = parseJSONFromAIText(response.text);
  return validateAndNormalizeScript(research, rawJson);
}
