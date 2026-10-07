import { describe, expect, it } from "bun:test";
import { editorAgent } from "../src/agents/editor.ts";
import { factCheckerAgent } from "../src/agents/fact_checker.ts";
import { metadataAgent } from "../src/agents/metadata.ts";
import { qaAgent } from "../src/agents/qa.ts";
import { researchAgent } from "../src/agents/research.ts";
import { scenePlannerAgent } from "../src/agents/scene_planner.ts";
import { scriptAgent } from "../src/agents/script.ts";
import { thumbnailAgent } from "../src/agents/thumbnail.ts";
import { visualAgent } from "../src/agents/visual.ts";
import { voiceAgent } from "../src/agents/voice.ts";
import { youtubeAgent } from "../src/agents/youtube.ts";
import app from "../src/index.ts";
import { MockAIService } from "../src/services/ai.ts";
import { MockImageService } from "../src/services/image.ts";
import { generateSubtitlesFromAudioSegments } from "../src/services/subtitles.ts";
import { MockVoiceService } from "../src/services/voice.ts";
import { GoogleYouTubeService, MockYouTubeService } from "../src/services/youtube.ts";
import type { GenerateContentResponse, PublishContentResponse } from "../src/types/content.ts";

describe("Curioverse Production Pipeline (Phases 1-7)", () => {
  const mockAI = new MockAIService();
  const mockImage = new MockImageService();
  const mockVoice = new MockVoiceService();

  describe("AI Service & Modular Agents", () => {
    it("should conduct structured research via Research Agent", async () => {
      const topic = "Why do humans dream?";
      const research = await researchAgent(topic, mockAI);

      expect(research.topic).toBe(topic);
      expect(research.summary.length).toBeGreaterThan(20);
      expect(research.keyPoints.length).toBeGreaterThan(0);
      expect(research.sources.length).toBeGreaterThan(0);
      expect(research.uncertainties.length).toBeGreaterThan(0);
    });

    it("should evaluate and classify claims via Fact Checker Agent", async () => {
      const topic = "Why do humans dream?";
      const research = await researchAgent(topic, mockAI);
      const factCheck = await factCheckerAgent(research, mockAI);

      expect(["VERIFIED", "QUALIFIED", "FLAGGED"]).toContain(factCheck.overallStatus);
      expect(factCheck.claims.length).toBeGreaterThan(0);
      expect(factCheck.claims[0]!.confidence).toBeGreaterThanOrEqual(0);
    });

    it("should generate a narrative script via Script Agent guided by fact-checking", async () => {
      const topic = "Why do humans dream?";
      const research = await researchAgent(topic, mockAI);
      const factCheck = await factCheckerAgent(research, mockAI);
      const script = await scriptAgent(research, factCheck, mockAI);

      expect(script.title).toBeDefined();
      expect(script.hook.length).toBeGreaterThan(20);
      expect(script.sections.length).toBeGreaterThanOrEqual(2);
      expect(script.estimatedDuration).toBeGreaterThan(0);
    });

    it("should plan visual scenes via Scene Planner Agent", async () => {
      const topic = "Why do humans dream?";
      const research = await researchAgent(topic, mockAI);
      const factCheck = await factCheckerAgent(research, mockAI);
      const script = await scriptAgent(research, factCheck, mockAI);
      const scenePlan = await scenePlannerAgent(script, mockAI);

      expect(scenePlan.scenes.length).toBeGreaterThan(0);
      expect(scenePlan.characters.length).toBeGreaterThan(0);
      expect(scenePlan.totalDuration).toBeGreaterThan(0);
    });

    it("should generate visual assets via Visual Agent adhering to Editorial Illustrated style", async () => {
      const topic = "Why do humans dream?";
      const research = await researchAgent(topic, mockAI);
      const factCheck = await factCheckerAgent(research, mockAI);
      const script = await scriptAgent(research, factCheck, mockAI);
      const scenePlan = await scenePlannerAgent(script, mockAI);
      const visuals = await visualAgent(scenePlan, mockImage);

      expect(visuals.totalGenerated).toBe(scenePlan.scenes.length);
      expect(visuals.assets[0]?.aspectRatio).toBe("16:9");
    });

    it("should generate synchronized narration segments via Voice Agent", async () => {
      const topic = "Why do humans dream?";
      const research = await researchAgent(topic, mockAI);
      const factCheck = await factCheckerAgent(research, mockAI);
      const script = await scriptAgent(research, factCheck, mockAI);
      const scenePlan = await scenePlannerAgent(script, mockAI);
      const voiceOver = await voiceAgent(script, scenePlan, mockVoice);

      expect(voiceOver.voiceId).toBe("onyx");
      expect(voiceOver.segments.length).toBe(script.sections.length);
      expect(voiceOver.totalDuration).toBeGreaterThan(0);
    });

    it("should compose Timeline and Subtitles via Editor Agent", async () => {
      const topic = "Why do humans dream?";
      const research = await researchAgent(topic, mockAI);
      const factCheck = await factCheckerAgent(research, mockAI);
      const script = await scriptAgent(research, factCheck, mockAI);
      const scenePlan = await scenePlannerAgent(script, mockAI);
      const visuals = await visualAgent(scenePlan, mockImage);
      const voiceOver = await voiceAgent(script, scenePlan, mockVoice);
      const render = await editorAgent(scenePlan, visuals, voiceOver);

      expect(render.timeline.width).toBe(1920);
      expect(render.timeline.height).toBe(1080);
      expect(render.subtitles.srt.length).toBeGreaterThan(0);
      expect(render.ffmpegCommand).toContain("ffmpeg");
    });

    it("should generate curiosity-driven thumbnail concepts via Thumbnail Agent", async () => {
      const topic = "Why do humans dream?";
      const research = await researchAgent(topic, mockAI);
      const factCheck = await factCheckerAgent(research, mockAI);
      const script = await scriptAgent(research, factCheck, mockAI);
      const thumbnail = await thumbnailAgent(script, research, mockAI, mockImage);

      expect(thumbnail.concepts.length).toBeGreaterThanOrEqual(1);
      expect(thumbnail.selectedConcept).toBeDefined();
      expect(thumbnail.selectedConcept.shortText.length).toBeGreaterThan(0);
      expect(thumbnail.selectedConcept.imageUrl).toBeDefined();

      // Check short text word count is concise
      const words = thumbnail.selectedConcept.shortText.trim().split(/\s+/).length;
      expect(words).toBeLessThanOrEqual(5);
    });

    it("should formulate YouTube metadata and chapters via Metadata Agent", async () => {
      const topic = "Why do humans dream?";
      const research = await researchAgent(topic, mockAI);
      const factCheck = await factCheckerAgent(research, mockAI);
      const script = await scriptAgent(research, factCheck, mockAI);
      const scenePlan = await scenePlannerAgent(script, mockAI);
      const visuals = await visualAgent(scenePlan, mockImage);
      const voiceOver = await voiceAgent(script, scenePlan, mockVoice);
      const render = await editorAgent(scenePlan, visuals, voiceOver);
      const metadata = await metadataAgent(script, research, render.timeline, mockAI);

      expect(metadata.title.length).toBeGreaterThan(5);
      expect(metadata.titleCandidates.length).toBeGreaterThanOrEqual(1);
      expect(metadata.description).toContain("Chapters:");
      expect(metadata.description).toContain("Sources & References:");
      expect(metadata.tags.length).toBeGreaterThan(3);
      expect(metadata.hashtags.length).toBeGreaterThan(1);
      expect(metadata.categoryId).toBe("27"); // Education
      expect(metadata.chapters.length).toBeGreaterThan(0);
      expect(metadata.chapters[0]!.timestamp).toBe("00:00");
    });

    it("should conduct comprehensive multi-dimensional QA inspection and output approval package", async () => {
      const topic = "Why do humans dream?";
      const research = await researchAgent(topic, mockAI);
      const factCheck = await factCheckerAgent(research, mockAI);
      const script = await scriptAgent(research, factCheck, mockAI);
      const scenePlan = await scenePlannerAgent(script, mockAI);
      const visuals = await visualAgent(scenePlan, mockImage);
      const voiceOver = await voiceAgent(script, scenePlan, mockVoice);
      const render = await editorAgent(scenePlan, visuals, voiceOver);
      const thumbnail = await thumbnailAgent(script, research, mockAI, mockImage);
      const metadata = await metadataAgent(script, research, render.timeline, mockAI);

      const { qa, approval } = await qaAgent({
        topic,
        research,
        factCheck,
        script,
        visuals,
        voiceOver,
        render,
        thumbnail,
        metadata,
      });

      expect(typeof qa.score).toBe("number");
      expect(qa.score).toBeGreaterThanOrEqual(70);
      expect(qa.passed).toBe(true);
      expect(Array.isArray(qa.recommendations)).toBe(true);

      // Verify human approval safeguards
      expect(approval.readyForReview).toBe(true);
      expect(approval.autoPublish).toBe(false); // MUST be false
      expect(approval.status).toBe("PENDING_HUMAN_REVIEW");
    });

    it("should upload video and thumbnail via MockYouTubeService", async () => {
      const mockYT = new MockYouTubeService({ autoPublish: false });
      const upload = await mockYT.uploadVideo({
        videoPath: "./output/video.mp4",
        title: "Why Do Humans Dream?",
        description: "An editorial exploration of human dreams.",
        tags: ["dreams", "science", "curioverse"],
        categoryId: "27",
        privacyStatus: "PRIVATE",
        thumbnailPathOrUrl: "https://example.com/thumb.jpg",
      });

      expect(upload.videoId).toBeDefined();
      expect(upload.videoUrl).toContain("https://youtu.be/");
      expect(upload.privacyStatus).toBe("PRIVATE");
      expect(upload.thumbnailUploaded).toBe(true);
      expect(upload.status).toBe("SIMULATED");
    });

    it("should downgrade public upload to private when autoPublish is false in YouTubeService", async () => {
      const mockYT = new MockYouTubeService({ autoPublish: false });
      const upload = await mockYT.uploadVideo({
        videoPath: "./output/video.mp4",
        title: "Why Do Humans Dream?",
        description: "Test description",
        tags: ["science"],
        categoryId: "27",
        privacyStatus: "PUBLIC",
      });

      expect(upload.privacyStatus).toBe("PRIVATE");
      expect(upload.safetyNotes).toBeDefined();
      expect(upload.safetyNotes?.[0]).toContain("[SAFETY GUARDRAIL]");
    });

    it("should permit public upload when autoPublish is true in MockYouTubeService", async () => {
      const mockYT = new MockYouTubeService({ autoPublish: true });
      const upload = await mockYT.uploadVideo({
        videoPath: "./output/video.mp4",
        title: "Public Video",
        description: "Test description",
        tags: ["science"],
        categoryId: "27",
        privacyStatus: "PUBLIC",
      });

      expect(upload.privacyStatus).toBe("PUBLIC");
      expect(upload.safetyNotes).toBeUndefined();
    });

    it("should throw error in GoogleYouTubeService if credentials are missing", async () => {
      const googleYT = new GoogleYouTubeService({
        clientId: "",
        clientSecret: "",
        refreshToken: "",
        accessToken: "",
      });

      expect(
        googleYT.uploadVideo({
          videoPath: "./output/video.mp4",
          title: "Test",
          description: "Test",
          tags: ["test"],
          categoryId: "27",
          privacyStatus: "PRIVATE",
        })
      ).rejects.toThrow("YouTube OAuth credentials missing");
    });

    it("should block YouTube Agent when human approval is not granted", async () => {
      const mockYT = new MockYouTubeService();

      expect(
        youtubeAgent(
          {
            videoPath: "./output/video.mp4",
            title: "Unapproved Video",
            approval: {
              readyForReview: true,
              autoPublish: false,
              status: "PENDING_HUMAN_REVIEW",
              notes: "Awaiting review",
            },
            humanApproved: false,
          },
          mockYT
        )
      ).rejects.toThrow("[PUBLICATION BLOCKED]");
    });

    it("should successfully publish video via YouTube Agent when humanApproved is true", async () => {
      const mockYT = new MockYouTubeService();

      const result = await youtubeAgent(
        {
          videoPath: "./output/video.mp4",
          title: "Approved Video",
          description: "Detailed description",
          tags: ["education", "science"],
          humanApproved: true,
          privacyStatus: "PRIVATE",
        },
        mockYT
      );

      expect(result.videoId).toBeDefined();
      expect(result.title).toBe("Approved Video");
      expect(result.privacyStatus).toBe("PRIVATE");
      expect(result.status).toBe("SIMULATED");
    });

    it("should successfully publish video via YouTube Agent with approved approval package", async () => {
      const mockYT = new MockYouTubeService();

      const result = await youtubeAgent(
        {
          videoPath: "./output/video.mp4",
          title: "Fully Reviewed Video",
          approval: {
            readyForReview: true,
            autoPublish: false,
            status: "APPROVED",
            notes: "Editorial team signed off",
          },
        },
        mockYT
      );

      expect(result.videoId).toBeDefined();
      expect(result.title).toBe("Fully Reviewed Video");
      expect(result.status).toBe("SIMULATED");
    });
  });

  describe("API Endpoints", () => {
    it("GET / should return healthy API status for Phase 7", async () => {
      const res = await app.fetch(new Request("http://localhost:3000/"));
      expect(res.status).toBe(200);
      const data = (await res.json()) as { status: string; phase: string; endpoints: Record<string, string> };
      expect(data.status).toBe("healthy");
      expect(data.phase).toContain("Phase 7");
      expect(data.endpoints.publish).toBe("POST /api/content/publish");
    });

    it("GET /health should return ok with phase 7", async () => {
      const res = await app.fetch(new Request("http://localhost:3000/health"));
      expect(res.status).toBe(200);
      const data = (await res.json()) as { status: string; phase: number };
      expect(data.status).toBe("ok");
      expect(data.phase).toBe(7);
    });

    it("POST /api/content/generate should reject missing topic with 400", async () => {
      const res = await app.fetch(
        new Request("http://localhost:3000/api/content/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      );
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("Missing required field: 'topic'");
    });

    it("POST /api/content/generate should reject empty topic string with 400", async () => {
      const res = await app.fetch(
        new Request("http://localhost:3000/api/content/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: "   " }),
        })
      );
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("non-empty string");
    });

    it("POST /api/content/generate should succeed and return full pipeline response", async () => {
      const res = await app.fetch(
        new Request("http://localhost:3000/api/content/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: "Why do humans dream?" }),
        })
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as GenerateContentResponse;

      // Phase 1 to 5 checks
      expect(data.topic).toBe("Why do humans dream?");
      expect(data.research).toBeDefined();
      expect(data.factCheck).toBeDefined();
      expect(data.script).toBeDefined();
      expect(data.scenePlan).toBeDefined();
      expect(data.visuals).toBeDefined();
      expect(data.voiceOver).toBeDefined();
      expect(data.render).toBeDefined();

      // Phase 6 checks
      expect(data.thumbnail).toBeDefined();
      expect(data.thumbnail?.selectedConcept.shortText).toBeDefined();
      expect(data.metadata).toBeDefined();
      expect(data.metadata?.title).toBeDefined();
      expect(data.metadata?.chapters.length).toBeGreaterThan(0);
      expect(data.qa).toBeDefined();
      expect(data.qa?.passed).toBe(true);
      expect(data.approval).toBeDefined();
      expect(data.approval?.autoPublish).toBe(false);
      expect(data.approval?.status).toBe("PENDING_HUMAN_REVIEW");
    });

    it("POST /api/content/publish should reject with 403 when approval is pending or not granted", async () => {
      const res = await app.fetch(
        new Request("http://localhost:3000/api/content/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoPath: "./output/video.mp4",
            title: "Unapproved Video",
            approval: {
              readyForReview: true,
              autoPublish: false,
              status: "PENDING_HUMAN_REVIEW",
              notes: "Not yet reviewed",
            },
            humanApproved: false,
          }),
        })
      );

      expect(res.status).toBe(403);
      const data = (await res.json()) as { success: boolean; error: string; message: string };
      expect(data.success).toBe(false);
      expect(data.error).toBe("PUBLICATION_BLOCKED");
      expect(data.message).toContain("Human approval is required");
    });

    it("POST /api/content/publish should succeed with 200 when human approved", async () => {
      const res = await app.fetch(
        new Request("http://localhost:3000/api/content/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoPath: "./output/video.mp4",
            title: "Approved Video Release",
            description: "Curioverse documentary on dreams.",
            tags: ["science", "dreams"],
            humanApproved: true,
            privacyStatus: "PRIVATE",
          }),
        })
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as PublishContentResponse;
      expect(data.success).toBe(true);
      expect(data.result).toBeDefined();
      expect(data.result?.videoId).toBeDefined();
      expect(data.result?.videoUrl).toContain("https://youtu.be/");
      expect(data.result?.privacyStatus).toBe("PRIVATE");
    });

    it("POST /api/content/publish should reject invalid non-JSON body with 400", async () => {
      const res = await app.fetch(
        new Request("http://localhost:3000/api/content/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "invalid-json",
        })
      );

      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("Invalid JSON payload");
    });
  });
});

