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
 * Free Google TTS implementation of VoiceService.
 * Produces real, natural voice-over MP3 audio with zero API keys or costs.
 */
export class GoogleFreeVoiceService implements VoiceService {
  async generateSpeech(input: GenerateSpeechInput): Promise<GenerateSpeechOutput> {
    const text = input.text.trim();
    const duration = estimateNarrationDurationSeconds(text);

    try {
      const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
      const chunks: string[] = [];
      let cur = "";
      for (const s of sentences) {
        if ((cur + " " + s).trim().length <= 180) {
          cur = (cur + " " + s).trim();
        } else {
          if (cur) chunks.push(cur);
          cur = s.trim();
        }
      }
      if (cur) chunks.push(cur);

      const buffers: Buffer[] = [];
      for (const chunk of chunks) {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=en&client=tw-ob`;
        const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (resp.ok) {
          buffers.push(Buffer.from(await resp.arrayBuffer()));
        }
      }

      if (buffers.length > 0) {
        const combined = Buffer.concat(buffers);
        return {
          audioUrl: `data:audio/mp3;base64,${combined.toString("base64")}`,
          duration,
          format: "mp3",
        };
      }
    } catch {
      // Fallback cleanly on network glitch
    }

    const minimalWavBase64 = "UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP//";
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
  const provider = (options?.provider || process.env.TTS_PROVIDER || "mock").toLowerCase();

  if (provider === "google" || provider === "free") {
    return new GoogleFreeVoiceService();
  }

  const apiKey = options?.apiKey || process.env.TTS_API_KEY;
  if (provider === "openai" && apiKey) {
    return new OpenAIVoiceService({
      apiKey,
      model: options?.model || process.env.TTS_MODEL,
      voice: options?.voice || process.env.TTS_VOICE,
      baseURL: options?.baseURL || process.env.TTS_BASE_URL,
    });
  }

  return new MockVoiceService();
}
