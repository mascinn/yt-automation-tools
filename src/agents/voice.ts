import { CHANNEL_DNA } from "../config/channel.ts";
import { createVoiceService, estimateNarrationDurationSeconds } from "../services/voice.ts";
import type {
  AudioSegment,
  ScenePlan,
  VideoScript,
  VoiceOverResult,
  VoiceService,
} from "../types/content.ts";

/**
 * Retries a voice generation attempt up to 2 times upon failure.
 */
async function generateSpeechWithRetry(
  service: VoiceService,
  text: string,
  voice: string,
  retries = 2
) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await service.generateSpeech({ text, voice });
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((res) => setTimeout(res, 300 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Curioverse Voice Agent
 * Orchestrates voice-over narration generation across script sections,
 * synchronizes audio pacing with planned visual scenes, and maintains natural English cadence.
 */
export async function voiceAgent(
  script: VideoScript,
  scenePlan?: ScenePlan,
  voiceService?: VoiceService
): Promise<VoiceOverResult> {
  const service = voiceService || createVoiceService();
  const voiceId = process.env.TTS_VOICE || "onyx";
  const voiceStyle = "Curioverse Editorial Documentary (Warm, deep, measured, contemplative pacing)";

  const segments: AudioSegment[] = [];

  for (let i = 0; i < script.sections.length; i++) {
    const section = script.sections[i]!;
    // Match corresponding scene if scenePlan exists
    const matchingScene = scenePlan?.scenes[i] || scenePlan?.scenes.find((s) => s.narration.includes(section.narration.slice(0, 30)));

    try {
      const speech = await generateSpeechWithRetry(service, section.narration, voiceId);

      segments.push({
        sectionId: section.id,
        sceneId: matchingScene?.id,
        text: section.narration,
        duration: speech.duration,
        audioUrl: speech.audioUrl,
        format: speech.format || "mp3",
        status: service.constructor.name === "MockVoiceService" ? "MOCK" : "GENERATED",
      });
    } catch (err) {
      console.warn(`[Voice Agent] Warning: Failed to generate audio for section "${section.id}":`, err);
      // Fallback segment with computed estimated duration
      const duration = estimateNarrationDurationSeconds(section.narration);
      segments.push({
        sectionId: section.id,
        sceneId: matchingScene?.id,
        text: section.narration,
        duration,
        audioUrl: `https://assets.curioverse.internal/audio/${section.id}.mp3`,
        format: "mp3",
        status: "MOCK",
      });
    }
  }

  const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);

  return {
    voiceId,
    voiceStyle,
    segments,
    totalDuration,
  };
}
