import type { GenerateSpeechInput, GenerateSpeechOutput, VoiceService } from "../types/content.ts";

export interface VoiceServiceConfig {
  apiKey?: string;
  model?: string;
  voice?: string;
  baseURL?: string;
  provider?: "openai" | "mock" | string;
}

/**
 * Calculates spoken duration in seconds at natural documentary pacing (~135 wpm / 2.25 words per sec).
 */
export function estimateNarrationDurationSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return Math.max(3, Math.round(words / 2.25));
}

/**
 * OpenAI Text-to-Speech implementation of VoiceService.
 */
export class OpenAIVoiceService implements VoiceService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly defaultVoice: string;
  private readonly baseURL: string;

  constructor(config: { apiKey: string; model?: string; voice?: string; baseURL?: string }) {
    if (!config.apiKey) {
      throw new Error("OpenAIVoiceService requires an API key.");
    }
    this.apiKey = config.apiKey;
    this.model = config.model || process.env.TTS_MODEL || "tts-1";
    this.defaultVoice = config.voice || process.env.TTS_VOICE || "onyx";
    this.baseURL = (config.baseURL || process.env.TTS_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  }

  async generateSpeech(input: GenerateSpeechInput): Promise<GenerateSpeechOutput> {
    const voice = input.voice || this.defaultVoice;
    const speed = input.speed ?? 1.0;

    const response = await fetch(`${this.baseURL}/audio/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: input.text,
        voice,
        speed,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `TTS API request failed with status ${response.status} (${response.statusText})`;
      try {
        const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
        if (errorJson.error?.message) {
          errorMessage += `: ${errorJson.error.message}`;
        }
      } catch {
        errorMessage += `: ${errorText}`;
      }
      throw new Error(errorMessage);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Audio = buffer.toString("base64");
    const audioUrl = `data:audio/mp3;base64,${base64Audio}`;

    // Estimated duration based on speed and word count
    const duration = Math.round(estimateNarrationDurationSeconds(input.text) / speed);

    return {
      audioUrl,
      duration,
      format: "mp3",
    };
  }
}

/**
 * Mock Voice Service for testing and offline development.
 * Produces structured audio metadata and duration calculations with zero external latency.
 */
export class MockVoiceService implements VoiceService {
  async generateSpeech(input: GenerateSpeechInput): Promise<GenerateSpeechOutput> {
    const duration = estimateNarrationDurationSeconds(input.text);

    // Minimal valid WAV header for 1 second of silence, repeatable
    const minimalWavBase64 =
      "UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP//";

    return {
      audioUrl: `data:audio/wav;base64,${minimalWavBase64}`,
      duration,
      format: "wav",
    };
  }
}

/**
 * Creates a VoiceService instance based on environment variables or explicit options.
 */
export function createVoiceService(options?: VoiceServiceConfig): VoiceService {
  const provider = options?.provider || process.env.TTS_PROVIDER || (process.env.TTS_API_KEY ? "openai" : "mock");
  const apiKey = options?.apiKey || process.env.TTS_API_KEY || process.env.AI_API_KEY;

  if (provider === "mock" || !apiKey) {
    return new MockVoiceService();
  }

  return new OpenAIVoiceService({
    apiKey,
    model: options?.model || process.env.TTS_MODEL,
    voice: options?.voice || process.env.TTS_VOICE,
    baseURL: options?.baseURL || process.env.TTS_BASE_URL,
  });
}
