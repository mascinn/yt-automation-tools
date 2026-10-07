import type { GenerateImageInput, GenerateImageOutput, ImageService } from "../types/content.ts";

export interface ImageServiceConfig {
  apiKey?: string;
  model?: string;
  baseURL?: string;
  provider?: "openai" | "mock" | string;
}

/**
 * OpenAI / DALL-E 3 implementation of ImageService.
 */
export class OpenAIImageService implements ImageService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseURL: string;

  constructor(config: { apiKey: string; model?: string; baseURL?: string }) {
    if (!config.apiKey) {
      throw new Error("OpenAIImageService requires an API key.");
    }
    this.apiKey = config.apiKey;
    this.model = config.model || process.env.IMAGE_MODEL || "dall-e-3";
    this.baseURL = (config.baseURL || process.env.IMAGE_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  }

  async generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
    // 16:9 standard for DALL-E 3 is 1792x1024
    const size = input.aspectRatio === "9:16" ? "1024x1792" : input.aspectRatio === "1:1" ? "1024x1024" : "1792x1024";

    const response = await fetch(`${this.baseURL}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        prompt: input.prompt,
        n: 1,
        size,
        response_format: "url",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Image generation API failed with status ${response.status} (${response.statusText})`;
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

    const data: unknown = await response.json();
    const parsed = data as {
      data?: Array<{ url?: string; revised_prompt?: string }>;
    };

    const imageUrl = parsed.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error("Image provider returned no image URL.");
    }

    return {
      url: imageUrl,
      format: "png",
      revisedPrompt: parsed.data?.[0]?.revised_prompt,
    };
  }
}

/**
 * Mock image generator for local development and CI testing.
 * Generates an elegant SVG data-URI styled with Curioverse Editorial Illustrated aesthetics.
 */
export class MockImageService implements ImageService {
  async generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
    const width = 1920;
    const height = 1080;
    const cleanPrompt = input.prompt.replace(/[<>&"]/g, " ").slice(0, 140);

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a1e29" />
      <stop offset="50%" stop-color="#242b3d" />
      <stop offset="100%" stop-color="#161a24" />
    </linearGradient>
    <filter id="paper-texture">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
      <feDiffuseLighting in="noise" lighting-color="#fff" surfaceScale="1" result="light">
        <feDistantLight azimuth="45" elevation="60" />
      </feDiffuseLighting>
      <feBlend mode="multiply" in="SourceGraphic" in2="light" />
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" />
  <rect x="60" y="60" width="${width - 120}" height="${height - 120}" fill="none" stroke="#d4af37" stroke-width="2" stroke-opacity="0.3" rx="16" />
  <circle cx="960" cy="540" r="320" fill="#2d3748" fill-opacity="0.25" stroke="#718096" stroke-width="1.5" stroke-dasharray="8 8" />
  <text x="960" y="440" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="#e2e8f0" text-anchor="middle" letter-spacing="4">CURIOVERSE EDITORIAL ILLUSTRATION</text>
  <text x="960" y="500" font-family="system-ui, -apple-system, sans-serif" font-size="18" fill="#a0aec0" text-anchor="middle" letter-spacing="2">2D / 2.5D PERSPECTIVE · MUTED PALETTE · 16:9</text>
  <foreignObject x="360" y="550" width="1200" height="180">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: system-ui, sans-serif; font-size: 16px; color: #cbd5e1; text-align: center; line-height: 1.6; padding: 10px; background: rgba(0,0,0,0.25); border-radius: 8px;">
      ${cleanPrompt}...
    </div>
  </foreignObject>
  <text x="960" y="960" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#64748b" text-anchor="middle" letter-spacing="3">CURIOVERSE VISUAL ASSET</text>
</svg>`.trim();

    const encodedSvg = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

    return {
      url: encodedSvg,
      format: "svg",
      revisedPrompt: input.prompt,
    };
  }
}

/**
 * Pollinations AI implementation of ImageService.
 * Free, high-resolution 16:9 widescreen AI illustration generator requiring zero API keys.
 */
export class PollinationsImageService implements ImageService {
  async generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
    const width = input.aspectRatio === "9:16" ? 720 : input.aspectRatio === "1:1" ? 1024 : 1280;
    const height = input.aspectRatio === "9:16" ? 1280 : input.aspectRatio === "1:1" ? 1024 : 720;

    const styleEnhanced = `${input.prompt}, editorial 2D illustration, documentary aesthetic, muted colors, textured grain, cinematic lighting`;
    const cleanPrompt = encodeURIComponent(styleEnhanced.slice(0, 400));
    const seed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${width}&height=${height}&nologo=true&seed=${seed}`;

    return {
      url: imageUrl,
      format: "jpg",
      revisedPrompt: styleEnhanced,
    };
  }
}

/**
 * Google Gemini / Imagen implementation of ImageService.
 * Calls Google AI Studio imagen/gemini image models with seamless fallback.
 */
export class GeminiImageService implements ImageService {
  private readonly apiKey: string;
  private readonly fallbackService: ImageService;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || "";
    this.fallbackService = new PollinationsImageService();
  }

  async generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
    if (!this.apiKey) {
      return this.fallbackService.generateImage(input);
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${encodeURIComponent(this.apiKey)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: input.prompt }],
          parameters: { sampleCount: 1, aspectRatio: input.aspectRatio || "16:9", outputMimeType: "image/jpeg" },
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { predictions?: Array<{ bytesBase64Encoded?: string }> };
        const b64 = data.predictions?.[0]?.bytesBase64Encoded;
        if (b64) {
          return {
            url: `data:image/jpeg;base64,${b64}`,
            format: "jpg",
            revisedPrompt: input.prompt,
          };
        }
      }
    } catch {
      // Fallback seamlessly on quota limit or network issue
    }

    return this.fallbackService.generateImage(input);
  }
}

/**
 * Creates an ImageService instance based on environment variables or explicit options.
 */
export function createImageService(options?: ImageServiceConfig): ImageService {
  const provider = (options?.provider || process.env.IMAGE_PROVIDER || "mock").toLowerCase();

  if (provider === "pollinations" || provider === "free") {
    return new PollinationsImageService();
  }

  if (provider === "gemini" || (provider === "google" && process.env.GEMINI_API_KEY)) {
    return new GeminiImageService();
  }

  const apiKey = options?.apiKey || process.env.IMAGE_API_KEY;
  if (provider === "openai" && apiKey) {
    return new OpenAIImageService({
      apiKey,
      model: options?.model || process.env.IMAGE_MODEL,
      baseURL: options?.baseURL || process.env.IMAGE_BASE_URL,
    });
  }

  return new MockImageService();
}
