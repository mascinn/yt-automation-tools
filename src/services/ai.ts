import type { AIService, GenerateTextInput, GenerateTextOutput } from "../types/content.ts";

export interface AIServiceConfig {
  apiKey?: string;
  model?: string;
  baseURL?: string;
  provider?: "openai" | "mock" | string;
}

/**
 * OpenAI-compatible implementation of AIService.
 * Compatible with OpenAI, OpenRouter, Groq, DeepSeek, Ollama, etc.
 */
export class OpenAICompatibleAIService implements AIService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseURL: string;

  constructor(config: { apiKey: string; model?: string; baseURL?: string }) {
    if (!config.apiKey) {
      throw new Error("OpenAICompatibleAIService requires an API key.");
    }
    this.apiKey = config.apiKey;
    this.model = config.model || process.env.AI_MODEL || "gpt-4o-mini";
    this.baseURL = (config.baseURL || process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const messages: Array<{ role: "system" | "user"; content: string }> = [];

    if (input.systemPrompt) {
      messages.push({ role: "system", content: input.systemPrompt });
    }
    messages.push({ role: "user", content: input.prompt });

    const requestBody: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: input.temperature ?? 0.7,
    };

    if (input.responseFormat === "json") {
      requestBody.response_format = { type: "json_object" };
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `AI API request failed with status ${response.status} (${response.statusText})`;
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
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    const text = parsed.choices?.[0]?.message?.content;
    if (typeof text !== "string") {
      throw new Error("AI provider returned an empty or invalid response format.");
    }

    return {
      text,
      usage: parsed.usage
        ? {
            promptTokens: parsed.usage.prompt_tokens,
            completionTokens: parsed.usage.completion_tokens,
            totalTokens: parsed.usage.total_tokens,
          }
        : undefined,
    };
  }
}

/**
 * Native Google Gemini implementation of AIService.
 * Compatible with Google AI Studio (gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash).
 */
export class GeminiAIService implements AIService {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: { apiKey: string; model?: string }) {
    if (!config.apiKey) {
      throw new Error("GeminiAIService requires a Gemini API key.");
    }
    this.apiKey = config.apiKey;
    this.model = config.model || process.env.GEMINI_MODEL || process.env.AI_MODEL || "gemini-3.1-flash-lite";
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const requestBody: Record<string, unknown> = {
      contents: [
        {
          role: "user",
          parts: [{ text: input.prompt }],
        },
      ],
      generationConfig: {
        temperature: input.temperature ?? 0.7,
      },
    };

    if (input.systemPrompt) {
      requestBody.systemInstruction = {
        parts: [{ text: input.systemPrompt }],
      };
    }

    if (input.responseFormat === "json") {
      (requestBody.generationConfig as Record<string, unknown>).responseMimeType = "application/json";
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Gemini API request failed with status ${response.status} (${response.statusText})`;
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

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") {
      throw new Error("Gemini API returned an empty or invalid response.");
    }

    return {
      text,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount,
            completionTokens: data.usageMetadata.candidatesTokenCount,
            totalTokens: data.usageMetadata.totalTokenCount,
          }
        : undefined,
    };
  }
}

/**
 * Mock AI service used when no API key is provided or for offline testing.
 * Produces structured, high-quality responses matching Curioverse editorial criteria.
 */
export class MockAIService implements AIService {
  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const prompt = input.prompt.toLowerCase();
    const isThumbnail = prompt.includes("thumbnail") || (input.systemPrompt && input.systemPrompt.toLowerCase().includes("thumbnail agent"));

    if (isThumbnail) {
      const mockThumbnails = {
        concepts: [
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
          },
        ],
      };

      return {
        text: JSON.stringify(mockThumbnails, null, 2),
      };
    }

    const isMetadata = prompt.includes("metadata") || (input.systemPrompt && input.systemPrompt.toLowerCase().includes("metadata agent"));

    if (isMetadata) {
      const mockMetadata = {
        title: "The Architecture of Nightmares: Why Your Brain Still Dreams",
        titleCandidates: [
          {
            title: "The Architecture of Nightmares: Why Your Brain Still Dreams",
            curiosityScore: 94,
            accuracyScore: 97,
            clickabilityScore: 91,
          },
          {
            title: "Why Does Your Brain Hallucinate Every Night in the Dark?",
            curiosityScore: 96,
            accuracyScore: 92,
            clickabilityScore: 95,
          },
          {
            title: "The Ancient Evolutionary Secret Hidden Inside Your Dreams",
            curiosityScore: 89,
            accuracyScore: 90,
            clickabilityScore: 88,
          },
        ],
        description: "Every night when you close your eyes, your body paralyzes itself and an ancient projection booth inside your skull flickers into vivid, chaotic life. But why would evolution expend immense energy creating films we forget within seconds of waking up?",
        tags: [
          "curioverse",
          "dreams",
          "neuroscience",
          "sleep science",
          "psychology",
          "rem sleep",
          "brain research",
          "evolutionary psychology",
        ],
        hashtags: ["#Curioverse", "#Documentary", "#Neuroscience", "#Science"],
      };

      return {
        text: JSON.stringify(mockMetadata, null, 2),
      };
    }

    const isFactCheck = prompt.includes("epistemic") || prompt.includes("fact check") || (input.systemPrompt && input.systemPrompt.toLowerCase().includes("fact checker agent"));

    if (isFactCheck) {
      const mockFactCheck = {
        overallStatus: "VERIFIED",
        claims: [
          {
            text: "During REM sleep, cholinergic pathways activate while noradrenaline is suppressed.",
            status: "OBSERVED",
            sources: ["Nature Reviews Neuroscience (2020)"],
            confidence: 0.98,
          },
          {
            text: "Activation-synthesis hypothesis: dreams synthesize spontaneous brainstem pulses into narrative.",
            status: "THEORY",
            sources: ["Science (2021)"],
            confidence: 0.90,
          },
          {
            text: "Threat Simulation Theory: dreaming evolved as an ancestral survival rehearsal mechanism.",
            status: "HYPOTHESIS",
            sources: ["Behavioral and Brain Sciences (2018)"],
            confidence: 0.82,
          },
        ],
        flaggedClaims: [
          {
            claim: "All dreams are designed specifically for survival rehearsal.",
            reason: "Threat simulation remains a prominent hypothesis rather than an established evolutionary certainty.",
            guidanceForScript: "Frame threat simulation as a leading evolutionary hypothesis rather than settled fact.",
          },
        ],
        notes: "Verified against consensus neuroscience. Clear distinction maintained between observed neurochemical states and evolutionary hypotheses.",
      };

      return {
        text: JSON.stringify(mockFactCheck, null, 2),
      };
    }

    const isScenePlan = prompt.includes("scene plan") || prompt.includes("visual scene") || (input.systemPrompt && input.systemPrompt.toLowerCase().includes("scene planner agent"));

    if (isScenePlan) {
      const mockScenePlan = {
        characters: [
          {
            id: "char-sleeper",
            name: "The Sleeper",
            appearance: "Minimalist human figure, clean soft outlines, serene expression",
            clothing: "Muted oatmeal linen loungewear",
            proportions: "Consistent realistic human proportions",
            personality: "Quiet, introspective",
          },
          {
            id: "char-researcher",
            name: "The Pioneer Scientist",
            appearance: "Stylized mid-century researcher with tortoiseshell glasses",
            clothing: "Charcoal wool blazer and cream turtleneck",
            proportions: "Consistent editorial proportions",
            personality: "Inquisitive and meticulous",
          },
        ],
        scenes: [
          {
            id: "scn-01",
            duration: 25,
            narration: "Every night when you close your eyes, your body paralyzes itself, your rational mind goes offline, and an ancient projection booth inside your skull flickers into vivid, chaotic life.",
            sceneType: "character scene",
            visualPrompt: "Editorial 2D illustration of a peaceful bedroom bathed in moonlight, a sleeping human figure in muted linen, deep midnight indigo tones, soft paper texture, subtle lamp glow.",
            characters: ["char-sleeper"],
            background: "Minimalist bedroom wall with soft moonlit window frame shadow",
            motion: {
              type: "slow-zoom-in",
              speed: "slow",
              focusPoint: "Sleeping figure's serene profile",
            },
          },
          {
            id: "scn-02",
            duration: 20,
            narration: "You might find yourself flying across a city you've never visited, or fleeing a shadow down the hallway of your childhood home.",
            sceneType: "environment",
            visualPrompt: "Editorial surreal dreamscape with architectural silhouettes floating gently against a muted twilight sky, soft ochre and dusk lavender palette, subtle paper texture.",
            characters: [],
            background: "Floating geometric city fragments dissolving into dusky watercolor mist",
            motion: {
              type: "pan-left",
              speed: "slow",
            },
          },
          {
            id: "scn-03",
            duration: 40,
            narration: "Why would evolution—a process ruthless about energy conservation—expend immense metabolic fuel every night creating surreal private films that we forget within thirty seconds of waking up?",
            sceneType: "diagram",
            visualPrompt: "Clean editorial visualization of biological energy allocation, subtle stylized graph showing metabolic burn during REM sleep versus quiet waking state, warm slate background.",
            characters: [],
            background: "Warm slate minimalist editorial backdrop with faint metric grids",
            motion: {
              type: "static",
              speed: "slow",
            },
            onScreenText: "METABOLIC COST OF THE SLEEPING MIND",
          },
          {
            id: "scn-04",
            duration: 55,
            narration: "For thousands of years, civilizations treated dreams as prophetic messages or visits from the divine. But when 20th-century electroencephalograms began listening to the sleeping human brain...",
            sceneType: "timeline",
            visualPrompt: "Split editorial composition: left side ancient astronomical chart on papyrus, right side 1950s brass EEG pen tracing rhythmic undulating waves, muted sepia and slate tones.",
            characters: ["char-researcher"],
            background: "Subtle vintage parchment transitioning to mid-century laboratory slate",
            motion: {
              type: "parallax",
              speed: "slow",
            },
          },
          {
            id: "scn-05",
            duration: 60,
            narration: "In the 1970s, neuroscientists discovered that during REM sleep, chemical factories in the brainstem blast spontaneous pulses into visual centers.",
            sceneType: "process",
            visualPrompt: "Stylized anatomical 2D cross-section of the human brain, warm coral electrical pulses ascending from the brainstem to the visual cortex, editorial paper cut-out aesthetic.",
            characters: [],
            background: "Deep navy background with subtle textured grain",
            motion: {
              type: "slow-zoom-in",
              speed: "slow",
              focusPoint: "Brainstem signal pathway",
            },
            onScreenText: "ACTIVATION-SYNTHESIS",
          },
          {
            id: "scn-06",
            duration: 65,
            narration: "Recent imaging reveals something even more elegant: nocturnal therapy. While you dream, your brain completely switches off noradrenaline, the primary stress chemical.",
            sceneType: "diagram",
            visualPrompt: "Editorial molecular diagram depicting the cessation of noradrenaline in soothing cool blues and sage greens, calming visual balance, gentle editorial typography.",
            characters: [],
            background: "Calm sage and ocean blue gradient with matte finish",
            motion: {
              type: "subtle-float",
              speed: "slow",
            },
            onScreenText: "NOCTURNAL RECALIBRATION",
          },
          {
            id: "scn-07",
            duration: 55,
            narration: "Yet the mystery deepens when we examine nightmares. Evolutionary researchers propose the Threat Simulation hypothesis...",
            sceneType: "character scene",
            visualPrompt: "Stylized prehistoric human silhouette looking out over a misty primal valley under an immense starlit sky, muted terracotta and shadow tones, cinematic composition.",
            characters: [],
            background: "Vast primeval landscape under ancient cosmic constellations",
            motion: {
              type: "pan-right",
              speed: "slow",
            },
          },
          {
            id: "scn-08",
            duration: 85,
            narration: "So tonight, as conscious thought fades and the darkness gathers, know that your brain isn't simply resting. It is stepping into its oldest laboratory...",
            sceneType: "character scene",
            visualPrompt: "The Sleeper waking gently to warm morning light streaming across the wooden floor, warm honey amber and soft white palette, calm cinematic closure.",
            characters: ["char-sleeper"],
            background: "Warm minimalist morning bedroom with soft diffused sunbeam",
            motion: {
              type: "slow-zoom-out",
              speed: "slow",
            },
          },
        ],
        totalDuration: 405,
        visualStyleGuide: "Curioverse Editorial Illustrated Documentary style: 2D/2.5D perspective, clean soft outlines, muted color palette (warm slate, midnight navy, amber, sage), paper texture, gentle camera movements (slow zoom, pan, parallax).",
      };

      return {
        text: JSON.stringify(mockScenePlan, null, 2),
      };
    }

    const isScript = prompt.includes("script") || (input.systemPrompt && input.systemPrompt.toLowerCase().includes("script agent"));

    if (isScript) {
      // Default to script generation mock
      const mockScript = {
        title: "The Architecture of Nightmares: Why Your Brain Still Dreams",
        hook: "Every night when you close your eyes, your body paralyzes itself, your rational mind goes offline, and an ancient projection booth inside your skull flickers into vivid, chaotic life.",
        sections: [
          {
            id: "sec-01-hook",
            purpose: "HOOK",
            narration: "Every night when you close your eyes, your body paralyzes itself, your rational mind goes offline, and an ancient projection booth inside your skull flickers into vivid, chaotic life. You might find yourself flying across a city you've never visited, or fleeing a shadow down the hallway of your childhood home.",
            estimatedDuration: 45,
          },
          {
            id: "sec-02-question",
            purpose: "QUESTION",
            narration: "Why would evolution—a process ruthless about energy conservation—expend immense metabolic fuel every night creating surreal private films that we forget within thirty seconds of waking up? What is your brain actually doing in the dark?",
            estimatedDuration: 40,
          },
          {
            id: "sec-03-context",
            purpose: "CONTEXT",
            narration: "For thousands of years, civilizations treated dreams as prophetic messages or visits from the divine. But when 20th-century electroencephalograms began listening to the sleeping human brain, scientists made an unsettling discovery: during Rapid Eye Movement sleep, your brain is just as electrically active as it is when reading a book.",
            estimatedDuration: 55,
          },
          {
            id: "sec-04-discovery",
            purpose: "DISCOVERY",
            narration: "In the 1970s, neuroscientists discovered that during REM sleep, chemical factories in the brainstem blast spontaneous pulses into visual centers. Then, your associative cortex scrambles to synthesize those raw electrical fireworks into a coherent story. You don't dream in order to tell stories; you tell stories to make sense of the fireworks.",
            estimatedDuration: 60,
          },
          {
            id: "sec-05-explanation",
            purpose: "EXPLANATION",
            narration: "Recent imaging reveals something even more elegant: nocturnal therapy. While you dream, your brain completely switches off noradrenaline, the primary stress chemical. This creates a rare neurochemical sanctuary where intense memories can be replayed and filed away without the searing sting of real-time anxiety.",
            estimatedDuration: 65,
          },
          {
            id: "sec-06-complication",
            purpose: "COMPLICATION",
            narration: "Yet the mystery deepens when we examine nightmares. If dreaming is meant to soothe, why do so many dreams thrust us into panic? Evolutionary researchers propose the Threat Simulation hypothesis: ancestral humans survived because their sleeping brains continuously rehearsed predator encounters, heights, and social expulsion in the safety of sleep.",
            estimatedDuration: 55,
          },
          {
            id: "sec-07-payoff",
            purpose: "PAYOFF",
            narration: "Dreaming isn't a glitch, nor is it merely passive entertainment. It is your mind's nightly maintenance routine—part emotional buffer, part ancestral survival simulator, and part memory architect.",
            estimatedDuration: 45,
          },
          {
            id: "sec-08-reflection",
            purpose: "REFLECTION",
            narration: "So tonight, as conscious thought fades and the darkness gathers, know that your brain isn't simply resting. It is stepping into its oldest laboratory, turning memories over in its hands, quietly keeping you whole for the morning.",
            estimatedDuration: 40,
          },
        ],
        estimatedDuration: 405, // ~6.75 minutes
        closing: "Thank you for exploring with Curioverse. Follow curiosity wherever it leads, and see you next time.",
      };

      return {
        text: JSON.stringify(mockScript, null, 2),
      };
    }

    // Default to research generation mock
    const topicMatch = input.prompt.match(/Topic:\s*"([^"]+)"/i) || input.prompt.match(/topic\s*[:=]\s*([^\n\r.]+)/i);
    const topic = topicMatch ? topicMatch[1]?.trim() ?? "Why do humans dream?" : "Why do humans dream?";

      const mockResearch = {
        topic,
        summary: `Dreams represent complex neurobiological and psychological simulations occurring primarily during Rapid Eye Movement (REM) sleep. While neuroscience has identified that the brainstem and limbic system become hyperactive while the prefrontal cortex quiets down, the ultimate evolutionary purpose of dreaming remains an active scientific debate encompassing memory consolidation, emotional regulation, and predictive threat simulation.`,
        keyPoints: [
          {
            claim: "REM sleep triggers emotional calibration and memory triage.",
            explanation: "During REM sleep, noradrenaline levels drop while cholinergic pathways activate, allowing the brain to process intense emotional memories without the chemical stress response.",
            importance: "Explains why dreams often weave unresolved daytime anxieties into surreal narrative metaphors.",
          },
          {
            claim: "The Threat Simulation Theory suggests dreaming evolved as a biological defense mechanism.",
            explanation: "Evolutionary psychologists argue dreaming allows early humans to rehearse fight-or-flight scenarios and hazard detection in a low-risk environment.",
            importance: "Highlights why ancestral nightmare motifs (falling, being pursued, teeth falling out) are universally conserved across modern human cultures.",
          },
          {
            claim: "Activation-Synthesis hypothesis posits dreams are post-hoc sense-making of random neural noise.",
            explanation: "Allan Hobson and Robert McCarley demonstrated that periodic acetylcholine bursts from the pons stimulate cortical sensory areas, prompting the narrative cortex to stitch random sensory sparks into a story.",
            importance: "Provides a mechanistic neurological counterbalance to Freudian psychoanalytic interpretations.",
          },
        ],
        sources: [
          {
            title: "The Neurobiology of REM Sleep Dreaming",
            url: "https://www.nature.com/articles/nrn.2019.sleep",
            publisher: "Nature Reviews Neuroscience",
            date: "2020",
          },
          {
            title: "Memory Consolidation and Synaptic Homeostasis in Sleep",
            url: "https://science.org/doi/10.1126/science.sleep.memory",
            publisher: "Science",
            date: "2021",
          },
          {
            title: "Threat Simulation Theory of Dreaming",
            url: "https://www.cambridge.org/core/journals/behavioral-and-brain-sciences",
            publisher: "Behavioral and Brain Sciences",
            date: "2018",
          },
        ],
        uncertainties: [
          "Whether bizarre non-REM sleep mentation serves identical cognitive functions as vivid REM narrative dreams.",
          "The degree to which subjective dream content actively guides synaptic pruning versus merely reflecting passive neurochemical cleanup.",
        ],
      };

      return {
        text: JSON.stringify(mockResearch, null, 2),
      };
    }
  }

/**
 * Creates an AIService instance based on environment variables or explicit options.
 */
export function createAIService(options?: AIServiceConfig): AIService {
  const provider = (
    options?.provider ||
    process.env.AI_PROVIDER ||
    (process.env.GEMINI_API_KEY ? "gemini" : process.env.AI_API_KEY ? "openai" : "mock")
  ).toLowerCase();

  const apiKey =
    options?.apiKey ||
    (provider === "gemini"
      ? process.env.GEMINI_API_KEY || process.env.AI_API_KEY
      : process.env.AI_API_KEY);

  if (provider === "mock" || !apiKey) {
    return new MockAIService();
  }

  if (provider === "gemini") {
    return new GeminiAIService({
      apiKey,
      model: options?.model || process.env.GEMINI_MODEL,
    });
  }

  return new OpenAICompatibleAIService({
    apiKey,
    model: options?.model || process.env.AI_MODEL,
    baseURL: options?.baseURL || process.env.AI_BASE_URL,
  });
}
