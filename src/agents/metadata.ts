import { CHANNEL_DNA } from "../config/channel.ts";
import { createAIService } from "../services/ai.ts";
import type {
  AIService,
  ResearchResult,
  Timeline,
  TitleCandidate,
  VideoChapter,
  VideoMetadata,
  VideoScript,
} from "../types/content.ts";

/**
 * Formats seconds into MM:SS timestamp format.
 */
function formatChapterTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Generates exact timeline chapters from script sections and timeline.
 */
function buildChapters(script: VideoScript, timeline: Timeline): VideoChapter[] {
  const chapters: VideoChapter[] = [];
  let elapsed = 0;

  for (let i = 0; i < script.sections.length; i++) {
    const sec = script.sections[i]!;
    // Clean up purpose into a human-readable chapter title
    const formattedTitle = sec.purpose
      .toLowerCase()
      .replace(/^./, (str) => str.toUpperCase());

    chapters.push({
      title: `${formattedTitle}: ${sec.narration.slice(0, 45).trim()}...`,
      timestamp: formatChapterTime(elapsed),
      seconds: elapsed,
    });

    elapsed += sec.estimatedDuration;
  }

  // Ensure first chapter always begins at 00:00
  if (chapters.length > 0 && chapters[0]!.seconds !== 0) {
    chapters[0]!.timestamp = "00:00";
    chapters[0]!.seconds = 0;
  }

  return chapters;
}

/**
 * Validates and normalizes raw JSON metadata from AI.
 */
function validateAndNormalizeMetadata(
  raw: unknown,
  script: VideoScript,
  research: ResearchResult,
  chapters: VideoChapter[]
): VideoMetadata {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Metadata Agent output is not a valid JSON object.");
  }

  const obj = raw as Record<string, unknown>;

  const candidates: TitleCandidate[] = [];
  if (Array.isArray(obj.titleCandidates)) {
    for (const c of obj.titleCandidates) {
      if (typeof c === "object" && c !== null) {
        const cObj = c as Record<string, unknown>;
        const title = typeof cObj.title === "string" ? cObj.title.trim() : "";
        if (title) {
          candidates.push({
            title,
            curiosityScore: typeof cObj.curiosityScore === "number" ? cObj.curiosityScore : 90,
            accuracyScore: typeof cObj.accuracyScore === "number" ? cObj.accuracyScore : 95,
            clickabilityScore: typeof cObj.clickabilityScore === "number" ? cObj.clickabilityScore : 88,
          });
        }
      }
    }
  }

  if (candidates.length === 0) {
    candidates.push(
      {
        title: script.title,
        curiosityScore: 92,
        accuracyScore: 96,
        clickabilityScore: 89,
      },
      {
        title: `The Architecture of Sleep: ${research.topic}`,
        curiosityScore: 88,
        accuracyScore: 98,
        clickabilityScore: 84,
      },
      {
        title: `Why Does Your Brain Create Dreams in the Dark?`,
        curiosityScore: 95,
        accuracyScore: 94,
        clickabilityScore: 92,
      }
    );
  }

  const selectedTitle = typeof obj.title === "string" && obj.title.trim()
    ? obj.title.trim()
    : candidates[0]!.title;

  const rawDescription = typeof obj.description === "string" && obj.description.trim()
    ? obj.description.trim()
    : "";

  // Assemble complete description including chapters and source bibliography
  const chaptersText = chapters.map((c) => `${c.timestamp} ${c.title}`).join("\n");
  const sourcesText = research.sources.map((s) => `• ${s.title} — ${s.publisher || "Academic Press"} (${s.url})`).join("\n");

  const fullDescription = `${rawDescription || script.hook}\n\n` +
    `Chapters:\n${chaptersText}\n\n` +
    `Sources & References:\n${sourcesText}\n\n` +
    `---\n` +
    `Curioverse is an editorial documentary channel dedicated to the curious, the unexpected, and the profound.\n` +
    `"Discover something you never knew you wanted to know."`;

  const tags: string[] = [];
  if (Array.isArray(obj.tags)) {
    for (const t of obj.tags) {
      if (typeof t === "string" && t.trim()) {
        tags.push(t.trim());
      }
    }
  }
  if (tags.length === 0) {
    tags.push("curioverse", "documentary", "science", "human behavior", "psychology", "neuroscience", "sleep");
  }

  const hashtags: string[] = [];
  if (Array.isArray(obj.hashtags)) {
    for (const h of obj.hashtags) {
      if (typeof h === "string" && h.trim()) {
        const cleaned = h.trim().startsWith("#") ? h.trim() : `#${h.trim()}`;
        hashtags.push(cleaned);
      }
    }
  }
  if (hashtags.length === 0) {
    hashtags.push("#Curioverse", "#Science", "#Documentary", "#Neuroscience");
  }

  return {
    title: selectedTitle,
    titleCandidates: candidates,
    description: fullDescription,
    tags,
    hashtags,
    category: "Education",
    categoryId: "27", // Standard YouTube Education category ID
    language: "en",
    chapters,
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
    throw new Error(`Failed to parse JSON metadata response from AI: ${(err as Error).message}`);
  }
}

/**
 * Curioverse Metadata Agent
 * Generates compelling titles evaluated on curiosity and integrity,
 * structured descriptions with chapters and source citations, tags, and category classification.
 */
export async function metadataAgent(
  script: VideoScript,
  research: ResearchResult,
  timeline: Timeline,
  aiService?: AIService
): Promise<VideoMetadata> {
  const service = aiService || createAIService();
  const chapters = buildChapters(script, timeline);

  const systemPrompt = `You are the lead Metadata Agent for Curioverse.
Your mission is to craft YouTube metadata that balances curiosity, clickability, and factual accuracy without deceptive clickbait.

Guidelines:
1. Title Candidates: Generate 3 to 5 candidate titles that stimulate authentic curiosity ("Wait... why is that?"). Score each candidate on curiosity, accuracy, and clickability.
2. Description: An engaging editorial summary that frames the central paradox and introduces the documentary.
3. Tags: 8 to 15 tightly relevant keywords. Avoid keyword stuffing.
4. Hashtags: 3 to 5 clean hashtags.
5. Output Format: Strictly valid JSON conforming to:

{
  "title": string,
  "titleCandidates": [
    {
      "title": string,
      "curiosityScore": number, // 0-100
      "accuracyScore": number, // 0-100
      "clickabilityScore": number // 0-100
    }
  ],
  "description": string,
  "tags": string[],
  "hashtags": string[]
}`;

  const prompt = `Generate metadata for the documentary:
Current Working Title: "${script.title}"
Topic: "${research.topic}"
Hook: "${script.hook}"
Summary: ${research.summary}

Return ONLY valid JSON.`;

  const response = await service.generateText({
    systemPrompt,
    prompt,
    temperature: 0.5,
    responseFormat: "json",
  });

  const rawJson = parseJSONFromAIText(response.text);
  return validateAndNormalizeMetadata(rawJson, script, research, chapters);
}
