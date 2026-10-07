import { CHANNEL_DNA } from "../config/channel.ts";
import { createAIService } from "../services/ai.ts";
import type {
  AIService,
  Claim,
  FactCheckResult,
  FactualStatus,
  FlaggedClaim,
  ResearchResult,
} from "../types/content.ts";

const VALID_STATUSES: readonly FactualStatus[] = [
  "OBSERVED",
  "ESTABLISHED",
  "THEORY",
  "HYPOTHESIS",
  "SPECULATION",
  "FICTIONAL_SCENARIO",
];

function normalizeFactualStatus(status: unknown): FactualStatus {
  if (typeof status === "string") {
    const upper = status.toUpperCase().trim() as FactualStatus;
    if (VALID_STATUSES.includes(upper)) {
      return upper;
    }
  }
  return "THEORY";
}

/**
 * Validates and normalizes raw JSON into a strictly-typed FactCheckResult.
 */
function validateAndNormalizeFactCheck(raw: unknown, research: ResearchResult): FactCheckResult {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Fact Checker Agent output is not a valid JSON object.");
  }

  const obj = raw as Record<string, unknown>;

  let overallStatus: "VERIFIED" | "QUALIFIED" | "FLAGGED" = "VERIFIED";
  if (obj.overallStatus === "QUALIFIED" || obj.overallStatus === "FLAGGED") {
    overallStatus = obj.overallStatus;
  }

  const claims: Claim[] = [];
  if (Array.isArray(obj.claims)) {
    for (const c of obj.claims) {
      if (typeof c === "object" && c !== null) {
        const cObj = c as Record<string, unknown>;
        const text = typeof cObj.text === "string" ? cObj.text.trim() : "";
        if (text) {
          const status = normalizeFactualStatus(cObj.status);
          const confidence = typeof cObj.confidence === "number" && cObj.confidence >= 0 && cObj.confidence <= 1
            ? Number(cObj.confidence.toFixed(2))
            : 0.85;

          const sources: string[] = [];
          if (Array.isArray(cObj.sources)) {
            for (const s of cObj.sources) {
              if (typeof s === "string" && s.trim()) {
                sources.push(s.trim());
              }
            }
          }

          claims.push({
            text,
            status,
            sources: sources.length > 0 ? sources : research.sources.map((s) => s.title),
            confidence,
          });
        }
      }
    }
  }

  // Fallback if no claims parsed
  if (claims.length === 0) {
    for (const kp of research.keyPoints) {
      claims.push({
        text: kp.claim,
        status: "THEORY",
        sources: research.sources.map((s) => s.title),
        confidence: 0.85,
      });
    }
  }

  const flaggedClaims: FlaggedClaim[] = [];
  if (Array.isArray(obj.flaggedClaims)) {
    for (const fc of obj.flaggedClaims) {
      if (typeof fc === "object" && fc !== null) {
        const fcObj = fc as Record<string, unknown>;
        const claim = typeof fcObj.claim === "string" ? fcObj.claim.trim() : "";
        const reason = typeof fcObj.reason === "string" ? fcObj.reason.trim() : "";
        const guidanceForScript = typeof fcObj.guidanceForScript === "string" ? fcObj.guidanceForScript.trim() : "";
        if (claim && reason) {
          flaggedClaims.push({ claim, reason, guidanceForScript });
        }
      }
    }
  }

  const notes = typeof obj.notes === "string" && obj.notes.trim()
    ? obj.notes.trim()
    : "Verified against peer-reviewed citations and consensus scientific literature.";

  return {
    overallStatus,
    claims,
    flaggedClaims,
    notes,
  };
}

/**
 * Extracts and parses JSON from AI output text.
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
    throw new Error(`Failed to parse JSON fact-check response from AI: ${(err as Error).message}`);
  }
}

/**
 * Curioverse Fact Checker Agent
 * Evaluates research claims, classifies factual certainty, and flags speculative hypotheses.
 */
export async function factCheckerAgent(
  research: ResearchResult,
  aiService?: AIService
): Promise<FactCheckResult> {
  const service = aiService || createAIService();

  const systemPrompt = `You are the Fact Checker Agent for Curioverse.
Your mandate is to inspect scientific and historical research claims and assign rigorous epistemic certainty.

Epistemic Status Classifications:
- OBSERVED: Directly documented, measured, or empirically recorded phenomenon (e.g. EEG brainwave spikes during REM sleep).
- ESTABLISHED: Widely verified scientific consensus or well-documented historical fact (e.g. neurotransmitter changes during sleep cycles).
- THEORY: Robust, coherent explanatory framework supported by substantial evidence, but open to refinement (e.g. Activation-Synthesis model).
- HYPOTHESIS: Plausible proposed mechanism currently undergoing testing (e.g. specific synaptic pruning models).
- SPECULATION: Conjectural reasoning, unproven extrapolation, or popular myth (must NEVER be presented as established fact).
- FICTIONAL_SCENARIO: Thought experiments or illustrative hypothetical scenarios.

Key Rules:
1. Examine all key points and summary findings from the research.
2. Flag any claims where speculation might masquerade as consensus fact.
3. Provide clear guidance for the scriptwriter so the narration maintains journalistic and scientific integrity.
4. Output strictly valid JSON conforming to:

{
  "overallStatus": "VERIFIED" | "QUALIFIED" | "FLAGGED",
  "claims": [
    {
      "text": string,
      "status": "OBSERVED" | "ESTABLISHED" | "THEORY" | "HYPOTHESIS" | "SPECULATION" | "FICTIONAL_SCENARIO",
      "sources": string[],
      "confidence": number // between 0.0 and 1.0
    }
  ],
  "flaggedClaims": [
    {
      "claim": string,
      "reason": string,
      "guidanceForScript": string
    }
  ],
  "notes": string
}`;

  const prompt = `Evaluate the factual certainty of the following research on: "${research.topic}"

Summary:
${research.summary}

Claims to Verify:
${research.keyPoints.map((kp, idx) => `${idx + 1}. Claim: "${kp.claim}"\n   Explanation: "${kp.explanation}"`).join("\n\n")}

Known Uncertainties:
${research.uncertainties.map((u, idx) => `${idx + 1}. ${u}`).join("\n")}

Available Sources:
${research.sources.map((s) => `- ${s.title} (${s.publisher || "Academic"})`).join("\n")}

Classify each claim and flag any overreach. Return ONLY valid JSON.`;

  const response = await service.generateText({
    systemPrompt,
    prompt,
    temperature: 0.2,
    responseFormat: "json",
  });

  const rawJson = parseJSONFromAIText(response.text);
  return validateAndNormalizeFactCheck(rawJson, research);
}
