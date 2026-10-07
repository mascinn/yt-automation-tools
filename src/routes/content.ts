import { Hono } from "hono";
import { editorAgent } from "../agents/editor.ts";
import { factCheckerAgent } from "../agents/fact_checker.ts";
import { metadataAgent } from "../agents/metadata.ts";
import { qaAgent } from "../agents/qa.ts";
import { researchAgent } from "../agents/research.ts";
import { scenePlannerAgent } from "../agents/scene_planner.ts";
import { scriptAgent } from "../agents/script.ts";
import { thumbnailAgent } from "../agents/thumbnail.ts";
import { visualAgent } from "../agents/visual.ts";
import { voiceAgent } from "../agents/voice.ts";
import { youtubeAgent } from "../agents/youtube.ts";
import type { GenerateContentResponse, PublishContentRequest } from "../types/content.ts";

export const contentRoute = new Hono();

/**
 * POST /api/content/generate
 * Phase 6 Pipeline:
 * Topic → Research → Fact Checker → Script → Scene Planner → Visual Agent → Voice Agent → Editor Agent → Thumbnail Agent → Metadata Agent → QA Agent → Approval → JSON
 */
contentRoute.post("/generate", async (c) => {
  let body: unknown;

  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        error: "Invalid JSON payload in request body.",
      },
      400
    );
  }

  if (typeof body !== "object" || body === null || !("topic" in body)) {
    return c.json(
      {
        error: "Missing required field: 'topic'. Example: { \"topic\": \"Why do humans dream?\" }",
      },
      400
    );
  }

  const rawTopic = (body as { topic: unknown }).topic;
  if (typeof rawTopic !== "string" || !rawTopic.trim()) {
    return c.json(
      {
        error: "The 'topic' field must be a non-empty string.",
      },
      400
    );
  }

  const topic = rawTopic.trim();

  try {
    // 1. Research Agent
    const research = await researchAgent(topic);

    // 2. Fact Checker Agent
    const factCheck = await factCheckerAgent(research);

    // 3. Script Agent (incorporating fact-check qualification)
    const script = await scriptAgent(research, factCheck);

    // 4. Scene Planner Agent
    const scenePlan = await scenePlannerAgent(script);

    // 5. Visual Agent (Phase 3)
    const visuals = await visualAgent(scenePlan);

    // 6. Voice Agent (Phase 4)
    const voiceOver = await voiceAgent(script, scenePlan);

    // 7. Editor Agent (Phase 5)
    const render = await editorAgent(scenePlan, visuals, voiceOver);

    // 8. Thumbnail Agent (Phase 6)
    const thumbnail = await thumbnailAgent(script, research);

    // 9. Metadata Agent (Phase 6)
    const metadata = await metadataAgent(script, research, render.timeline);

    // 10. QA Agent & Human Approval Package (Phase 6)
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

    // 11. Assemble Master Response
    const responsePayload: GenerateContentResponse = {
      topic: research.topic,
      research,
      sources: research.sources,
      factCheck,
      script,
      sections: script.sections,
      scenePlan,
      scenes: scenePlan.scenes,
      characters: scenePlan.characters,
      visuals,
      assets: visuals.assets,
      voiceOver,
      audioSegments: voiceOver.segments,
      render,
      timeline: render.timeline,
      subtitles: render.subtitles,
      thumbnail,
      metadata,
      qa,
      approval,
      estimatedDuration: render.duration || voiceOver.totalDuration || script.estimatedDuration,
    };

    return c.json(responsePayload, 200);
  } catch (error) {
    const err = error as Error;
    console.error(`[Content Generation Error] Topic: "${topic}":`, err);

    return c.json(
      {
        error: "Failed to generate content pipeline for topic.",
        message: err.message,
      },
      500
    );
  }
});

/**
 * POST /api/content/publish
 * Phase 7: YouTube Publishing Gateway
 * Validates human approval, prepares assets, enforces publication safeguards, and calls YouTube Data API.
 */
contentRoute.post("/publish", async (c) => {
  let body: unknown;

  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        error: "Invalid JSON payload in request body.",
      },
      400
    );
  }

  if (typeof body !== "object" || body === null) {
    return c.json(
      {
        error: "Invalid request payload. Expected a JSON object.",
      },
      400
    );
  }

  const req = body as PublishContentRequest;

  try {
    const result = await youtubeAgent(req);
    return c.json(
      {
        success: true,
        result,
      },
      200
    );
  } catch (error) {
    const err = error as Error;
    const isApprovalBlocked = err.message.includes("[PUBLICATION BLOCKED]");

    if (isApprovalBlocked) {
      return c.json(
        {
          success: false,
          error: "PUBLICATION_BLOCKED",
          message: err.message,
        },
        403
      );
    }

    return c.json(
      {
        success: false,
        error: "PUBLISH_FAILED",
        message: err.message,
      },
      500
    );
  }
});

