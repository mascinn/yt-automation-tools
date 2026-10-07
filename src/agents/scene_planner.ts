import { CHANNEL_DNA } from "../config/channel.ts";
import { createAIService } from "../services/ai.ts";
import type {
  AIService,
  CharacterProfile,
  MotionPlan,
  Scene,
  ScenePlan,
  SceneType,
  VideoScript,
} from "../types/content.ts";

const VALID_SCENE_TYPES: readonly SceneType[] = [
  "character scene",
  "environment",
  "diagram",
  "map",
  "timeline",
  "statistic",
  "quote",
  "comparison",
  "process",
  "cosmic scale",
  "transition",
];

const VALID_MOTION_TYPES: readonly MotionPlan["type"][] = [
  "slow-zoom-in",
  "slow-zoom-out",
  "pan-left",
  "pan-right",
  "parallax",
  "static",
  "subtle-float",
];

function normalizeSceneType(raw: unknown): SceneType {
  if (typeof raw === "string") {
    const val = raw.toLowerCase().trim() as SceneType;
    if (VALID_SCENE_TYPES.includes(val)) {
      return val;
    }
  }
  return "environment";
}

function normalizeMotionPlan(raw: unknown): MotionPlan {
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const type = typeof obj.type === "string" && VALID_MOTION_TYPES.includes(obj.type as MotionPlan["type"])
      ? (obj.type as MotionPlan["type"])
      : "slow-zoom-in";
    const speed = obj.speed === "medium" ? "medium" : "slow";
    const focusPoint = typeof obj.focusPoint === "string" ? obj.focusPoint.trim() : undefined;
    return { type, speed, focusPoint };
  }
  return { type: "slow-zoom-in", speed: "slow" };
}

/**
 * Validates and normalizes raw JSON into a strictly-typed ScenePlan.
 */
function validateAndNormalizeScenePlan(raw: unknown, script: VideoScript): ScenePlan {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Scene Planner Agent output is not a valid JSON object.");
  }

  const obj = raw as Record<string, unknown>;

  const characters: CharacterProfile[] = [];
  if (Array.isArray(obj.characters)) {
    for (const c of obj.characters) {
      if (typeof c === "object" && c !== null) {
        const cObj = c as Record<string, unknown>;
        const id = typeof cObj.id === "string" ? cObj.id.trim() : `char-${characters.length + 1}`;
        const name = typeof cObj.name === "string" ? cObj.name.trim() : "Observer";
        const appearance = typeof cObj.appearance === "string" ? cObj.appearance.trim() : "Editorial minimalist human";
        const clothing = typeof cObj.clothing === "string" ? cObj.clothing.trim() : "Contemporary muted editorial attire";
        const proportions = typeof cObj.proportions === "string" ? cObj.proportions.trim() : "Realistic editorial proportions";
        const personality = typeof cObj.personality === "string" ? cObj.personality.trim() : "Contemplative, curious";

        characters.push({ id, name, appearance, clothing, proportions, personality });
      }
    }
  }

  if (characters.length === 0) {
    characters.push({
      id: "char-observer",
      name: "The Contemplative Observer",
      appearance: "Editorial minimalist human figure with soft facial geometry and clean silhouettes",
      clothing: "Muted charcoal knit sweater and dark slate trousers",
      proportions: "Consistent realistic human proportions with gentle stylized outlines",
      personality: "Thoughtful, observant, and curious",
    });
  }

  const scenes: Scene[] = [];
  if (Array.isArray(obj.scenes)) {
    for (let i = 0; i < obj.scenes.length; i++) {
      const s = obj.scenes[i];
      if (typeof s === "object" && s !== null) {
        const sObj = s as Record<string, unknown>;
        const id = typeof sObj.id === "string" && sObj.id.trim() ? sObj.id.trim() : `scn-${String(i + 1).padStart(2, "0")}`;
        const duration = typeof sObj.duration === "number" && sObj.duration > 0 ? Math.round(sObj.duration) : 10;
        const narration = typeof sObj.narration === "string" ? sObj.narration.trim() : "";
        const sceneType = normalizeSceneType(sObj.sceneType);
        const visualPrompt = typeof sObj.visualPrompt === "string" && sObj.visualPrompt.trim()
          ? sObj.visualPrompt.trim()
          : "Editorial illustrated 2D composition, muted tones, soft outlines, subtle paper texture.";
        const charIds: string[] = [];
        if (Array.isArray(sObj.characters)) {
          for (const ch of sObj.characters) {
            if (typeof ch === "string" && ch.trim()) {
              charIds.push(ch.trim());
            }
          }
        }
        const background = typeof sObj.background === "string" && sObj.background.trim()
          ? sObj.background.trim()
          : "Minimalist atmospheric gradient with soft directional lighting";
        const motion = normalizeMotionPlan(sObj.motion);
        const onScreenText = typeof sObj.onScreenText === "string" && sObj.onScreenText.trim()
          ? sObj.onScreenText.trim()
          : undefined;

        scenes.push({
          id,
          duration,
          narration,
          sceneType,
          visualPrompt,
          characters: charIds,
          background,
          motion,
          onScreenText,
        });
      }
    }
  }

  // Fallback: create scenes corresponding to script sections if none returned
  if (scenes.length === 0) {
    for (let i = 0; i < script.sections.length; i++) {
      const section = script.sections[i]!;
      scenes.push({
        id: `scn-${String(i + 1).padStart(2, "0")}`,
        duration: section.estimatedDuration,
        narration: section.narration,
        sceneType: i % 2 === 0 ? "character scene" : "diagram",
        visualPrompt: `Editorial 2D documentary illustration depicting ${section.purpose.toLowerCase()}: ${section.narration.slice(0, 100)}... Clean soft outlines, muted color palette, editorial paper texture, cinematic lighting.`,
        characters: ["char-observer"],
        background: "Subtle muted studio gradient with gentle editorial shadow",
        motion: { type: "slow-zoom-in", speed: "slow" },
      });
    }
  }

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);

  const visualStyleGuide = typeof obj.visualStyleGuide === "string" && obj.visualStyleGuide.trim()
    ? obj.visualStyleGuide.trim()
    : "Editorial Illustrated Documentary style: 2D/2.5D perspective, clean soft outlines, muted color palette (warm slate, ochre, midnight indigo), subtle paper texture, gentle camera movements (slow zoom, subtle parallax). Avoid 3D, photorealism, and hyper-saturated cartoons.";

  return {
    scenes,
    characters,
    totalDuration,
    visualStyleGuide,
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
    throw new Error(`Failed to parse JSON scene-plan response from AI: ${(err as Error).message}`);
  }
}

/**
 * Curioverse Scene Planner Agent
 * Breaks down narration script sections into visual scenes with character profiles,
 * camera motion plans, and aesthetic prompts adhering to the Editorial Illustrated style.
 */
export async function scenePlannerAgent(
  script: VideoScript,
  aiService?: AIService
): Promise<ScenePlan> {
  const service = aiService || createAIService();

  const systemPrompt = `You are the lead Scene Planner Agent for Curioverse.
Your mission is to translate a documentary script into a compelling visual sequence.

Curioverse Visual Identity:
- Style: Editorial Illustrated Documentary
- Perspective: 2D digital illustration, 2D/2.5D perspective
- Linework: Clean soft outlines
- Palette: Controlled, muted, harmonious palette (warm slate, midnight navy, ochre, muted earth tones)
- Lighting: Soft cinematic lighting with gentle editorial paper texture
- Motion: Subtle camera movements (slow-zoom-in, slow-zoom-out, pan-left, pan-right, parallax, subtle-float)
- Strict Prohibitions: NO photorealism, NO anime, NO childish 3D cartoons, NO hyper-saturated neon colors.
- Narration is the backbone: Visuals support and elevate the narration rather than overpower it.
- Rule: DO NOT blindly make one image per sentence. Group narration into meaningful, cinematic visual scenes (each scene typically 8–25 seconds).

Available Scene Types:
- "character scene": Human subject in thoughtful posture or interaction
- "environment": Atmospheric landscape, room, or setting
- "diagram": Clean conceptual breakdown, brain cross-section, or scientific visualization
- "map": Stylized geographic or conceptual territory
- "timeline": Historical or chronological progression
- "statistic": Clean editorial data visualization
- "quote": Notable historical citation in elegant typography
- "comparison": Side-by-side or split visual juxtaposition
- "process": Step-by-step biological or physical mechanism
- "cosmic scale": Vast astronomical or microscopic perspective shift
- "transition": Minimalist visual breath or motif shift

Output Format: Strictly valid JSON conforming to:
{
  "characters": [
    {
      "id": string,
      "name": string,
      "appearance": string,
      "clothing": string,
      "proportions": string,
      "personality": string
    }
  ],
  "scenes": [
    {
      "id": string,
      "duration": number, // in seconds
      "narration": string, // narration excerpt covered by this scene
      "sceneType": "character scene" | "environment" | "diagram" | "map" | "timeline" | "statistic" | "quote" | "comparison" | "process" | "cosmic scale" | "transition",
      "visualPrompt": string, // highly descriptive prompt for 2D editorial illustration
      "characters": string[], // ids of characters present
      "background": string,
      "motion": {
        "type": "slow-zoom-in" | "slow-zoom-out" | "pan-left" | "pan-right" | "parallax" | "static" | "subtle-float",
        "speed": "slow" | "medium",
        "focusPoint": string
      },
      "onScreenText": string // optional clean graphic text
    }
  ],
  "visualStyleGuide": string
}`;

  const prompt = `Plan the visual scenes for the following documentary script:
Title: "${script.title}"
Total Estimated Duration: ${script.estimatedDuration} seconds

Sections:
${script.sections.map((sec) => `[${sec.id}] (${sec.purpose}, ~${sec.estimatedDuration}s):\n"${sec.narration}"`).join("\n\n")}

Design 10 to 18 cohesive visual scenes across the script. Ensure character consistency and varied scene types. Return ONLY valid JSON.`;

  const response = await service.generateText({
    systemPrompt,
    prompt,
    temperature: 0.5,
    responseFormat: "json",
  });

  const rawJson = parseJSONFromAIText(response.text);
  return validateAndNormalizeScenePlan(rawJson, script);
}
