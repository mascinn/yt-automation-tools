import { CHANNEL_DNA } from "../config/channel.ts";
import { createAIService } from "../services/ai.ts";
import { createImageService } from "../services/image.ts";
import type {
  AIService,
  ImageService,
  ResearchResult,
  ThumbnailConcept,
  ThumbnailResult,
  VideoScript,
} from "../types/content.ts";

/**
 * Validates and normalizes raw JSON thumbnail concepts from AI.
 */
function validateAndNormalizeThumbnailConcepts(raw: unknown, script: VideoScript): ThumbnailConcept[] {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Thumbnail Agent output is not a valid JSON object.");
  }

  const obj = raw as Record<string, unknown>;
  const concepts: ThumbnailConcept[] = [];

  if (Array.isArray(obj.concepts)) {
    for (let i = 0; i < obj.concepts.length; i++) {
      const c = obj.concepts[i];
      if (typeof c === "object" && c !== null) {
        const cObj = c as Record<string, unknown>;
        const id = typeof cObj.id === "string" && cObj.id.trim() ? cObj.id.trim() : `thumb-concept-${i + 1}`;
        const shortText = typeof cObj.shortText === "string" && cObj.shortText.trim()
          ? cObj.shortText.trim().toUpperCase()
          : "WHY THIS?";
        const visualPrompt = typeof cObj.visualPrompt === "string" && cObj.visualPrompt.trim()
          ? cObj.visualPrompt.trim()
          : "Editorial illustrated 2D composition with bold central focal element and clean silhouette.";
        const curiosityHook = typeof cObj.curiosityHook === "string" && cObj.curiosityHook.trim()
          ? cObj.curiosityHook.trim()
          : "Explores the counterintuitive mystery at the heart of the documentary.";

        concepts.push({ id, shortText, visualPrompt, curiosityHook });
      }
    }
  }

  if (concepts.length === 0) {
    concepts.push(
      {
        id: "thumb-concept-01",
        shortText: "WHY IN THE DARK?",
        visualPrompt: "Editorial 2D illustration of a peaceful human profile sleeping, with an intricate glowing clockwork projection booth radiating from within the skull into deep midnight indigo mist. High contrast, subtle paper texture.",
        curiosityHook: "Focuses on the paradox of hyperactive brain activity during physical paralysis.",
      },
      {
        id: "thumb-concept-02",
        shortText: "NOT A GLITCH",
        visualPrompt: "Editorial split illustration showing a waking human next to an ancient silhouette fleeing shadows in a primordial mist. Warm ochre and slate palette, stark cinematic composition.",
        curiosityHook: "Focuses on the survival threat simulation theory.",
      },
      {
        id: "thumb-concept-03",
        shortText: "WHO DIRECTS IT?",
        visualPrompt: "Editorial illustration of an illuminated film projector floating in an empty neoclassical bedroom chamber, casting vibrant electrical neurological bursts across dark slate walls.",
        curiosityHook: "Highlights the activation-synthesis sense-making dilemma.",
      }
    );
  }

  return concepts;
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
    throw new Error(`Failed to parse JSON thumbnail response from AI: ${(err as Error).message}`);
  }
}

/**
 * Curioverse Thumbnail Agent
 * Analyzes the script to extract the central curiosity tension,
 * produces 3 bold concept options with short readable text,
 * and renders the primary thumbnail illustration.
 */
export async function thumbnailAgent(
  script: VideoScript,
  research: ResearchResult,
  aiService?: AIService,
  imageService?: ImageService
): Promise<ThumbnailResult> {
  const service = aiService || createAIService();
  const imgService = imageService || createImageService();

  const systemPrompt = `You are the lead Thumbnail Agent for Curioverse.
Your mission is to formulate curiosity-inducing YouTube thumbnail concepts.

Rules for Curioverse Thumbnails:
1. Hook & Tension: Pinpoint the single most irresistible question or visual paradox in the documentary.
2. Short Text: 2 to 4 WORDS MAXIMUM. All-caps, bold, instantly legible at small mobile size (e.g. "WHY 2 AM?", "NOT A GLITCH", "THE BRAIN'S SECRET").
3. Aesthetic Alignment: Editorial Illustrated Documentary style (2D digital illustration, clean outlines, paper texture, controlled palette with bold focal contrast).
4. Honesty: NO misleading clickbait or exaggerated grotesque faces. The thumbnail must honor the intelligence of the content.
5. Return strictly valid JSON conforming to:

{
  "concepts": [
    {
      "id": string,
      "shortText": string, // 2 to 4 words max
      "visualPrompt": string, // Detailed prompt for 16:9 thumbnail illustration
      "curiosityHook": string
    }
  ]
}`;

  const prompt = `Develop 3 thumbnail concepts for:
Title: "${script.title}"
Topic: "${research.topic}"
Hook: "${script.hook}"
Summary: ${research.summary}

Return ONLY valid JSON with 3 diverse concepts.`;

  const response = await service.generateText({
    systemPrompt,
    prompt,
    temperature: 0.6,
    responseFormat: "json",
  });

  const rawJson = parseJSONFromAIText(response.text);
  const concepts = validateAndNormalizeThumbnailConcepts(rawJson, script);
  const selectedConcept = concepts[0]!;

  // Generate thumbnail artwork using ImageService
  try {
    const fullImagePrompt = `Editorial illustrated YouTube thumbnail. 16:9 widescreen composition. ${selectedConcept.visualPrompt} Bold, high visual hierarchy, clean soft outlines, subtle paper texture, dramatic cinematic lighting, rich muted palette. Minimal clutter for mobile readability. Negative constraints: no photorealism, no 3D render, no anime.`;

    const imgOutput = await imgService.generateImage({
      prompt: fullImagePrompt,
      aspectRatio: "16:9",
      style: "editorial-thumbnail",
    });

    selectedConcept.imageUrl = imgOutput.url;
  } catch (err) {
    console.warn("[Thumbnail Agent] Failed to render thumbnail artwork:", err);
    selectedConcept.imageUrl = "https://assets.curioverse.internal/thumbnails/default.png";
  }

  return {
    concepts,
    selectedConcept,
  };
}
