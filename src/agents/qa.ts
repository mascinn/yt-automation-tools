import type {
  ApprovalPackage,
  FactCheckResult,
  QAIssue,
  QAResult,
  RenderResult,
  ResearchResult,
  ThumbnailResult,
  VideoMetadata,
  VideoScript,
  VisualGenerationResult,
  VoiceOverResult,
} from "../types/content.ts";

export interface FullProjectPayload {
  topic: string;
  research: ResearchResult;
  factCheck?: FactCheckResult;
  script: VideoScript;
  visuals?: VisualGenerationResult;
  voiceOver?: VoiceOverResult;
  render?: RenderResult;
  thumbnail?: ThumbnailResult;
  metadata?: VideoMetadata;
}

/**
 * Curioverse QA Agent
 * Performs automated multi-dimensional inspection across research, script,
 * visuals, voice audio, timeline video composition, and distribution metadata.
 * Enforces human review by defaulting AUTO_PUBLISH to false.
 */
export async function qaAgent(payload: FullProjectPayload): Promise<{
  qa: QAResult;
  approval: ApprovalPackage;
}> {
  const issues: QAIssue[] = [];
  const recommendations: string[] = [];
  let score = 100;

  // 1. Research & Fact-Check Inspection
  if (!payload.research || payload.research.sources.length === 0) {
    issues.push({
      category: "research",
      severity: "high",
      message: "No authoritative sources found in research payload.",
    });
    score -= 15;
  }

  if (payload.factCheck?.flaggedClaims && payload.factCheck.flaggedClaims.length > 0) {
    recommendations.push(
      `Attention required: ${payload.factCheck.flaggedClaims.length} scientific claim(s) flagged as speculative. Ensure narration frames them as hypotheses.`
    );
  }

  // 2. Script Inspection
  const forbiddenCliches = [
    "hello guys",
    "welcome back",
    "delve",
    "testament",
    "tapestry",
    "beacon",
    "in a world where",
    "but here's the thing",
  ];

  const fullNarration = payload.script.sections.map((s) => s.narration).join(" ").toLowerCase();
  for (const cliche of forbiddenCliches) {
    if (fullNarration.includes(cliche)) {
      issues.push({
        category: "script",
        severity: "medium",
        message: `Forbidden cliché detected in script narration: "${cliche}".`,
      });
      score -= 5;
    }
  }

  if (payload.script.sections.length < 4) {
    issues.push({
      category: "script",
      severity: "medium",
      message: "Script contains fewer than 4 structured sections; documentary pacing may feel brief.",
    });
    score -= 5;
  }

  // 3. Visuals Inspection
  if (payload.visuals) {
    if (payload.visuals.assets.length === 0) {
      issues.push({
        category: "visuals",
        severity: "critical",
        message: "No visual assets were generated for the documentary scenes.",
      });
      score -= 30;
    } else {
      const nonWidescreen = payload.visuals.assets.filter((a) => a.aspectRatio !== "16:9");
      if (nonWidescreen.length > 0) {
        issues.push({
          category: "visuals",
          severity: "high",
          message: `${nonWidescreen.length} visual asset(s) do not conform to 16:9 widescreen aspect ratio.`,
        });
        score -= 10;
      }
    }
  }

  // 4. Audio / Voice Inspection
  if (payload.voiceOver) {
    if (payload.voiceOver.segments.length === 0) {
      issues.push({
        category: "audio",
        severity: "critical",
        message: "Voice-over contains zero audio narration segments.",
      });
      score -= 25;
    } else if (payload.voiceOver.segments.length !== payload.script.sections.length) {
      issues.push({
        category: "audio",
        severity: "medium",
        message: "Audio segments count does not match the script sections count.",
      });
      score -= 5;
    }
  }

  // 5. Video / Timeline Inspection
  if (payload.render?.timeline) {
    const { width, height, fps, tracks } = payload.render.timeline;
    if (width !== 1920 || height !== 1080) {
      issues.push({
        category: "video",
        severity: "high",
        message: `Timeline dimensions (${width}x${height}) do not match 1080p standard (1920x1080).`,
      });
      score -= 10;
    }
    if (fps !== 30 && fps !== 60) {
      issues.push({
        category: "video",
        severity: "medium",
        message: `Non-standard frame rate: ${fps} fps. Recommend 30 or 60 fps.`,
      });
      score -= 5;
    }
    const hasVideo = tracks.some((t) => t.type === "video");
    const hasAudio = tracks.some((t) => t.type === "narration");
    if (!hasVideo || !hasAudio) {
      issues.push({
        category: "video",
        severity: "critical",
        message: "Timeline missing fundamental video or narration audio track.",
      });
      score -= 25;
    }
  }

  // 6. Metadata & Thumbnail Inspection
  if (payload.metadata) {
    if (payload.metadata.title.length > 100) {
      issues.push({
        category: "metadata",
        severity: "high",
        message: "YouTube title exceeds 100 characters limit.",
      });
      score -= 10;
    }
    if (!payload.metadata.chapters || payload.metadata.chapters.length === 0) {
      recommendations.push("Include timestamped video chapters to improve viewer retention and search SEO.");
    }
  }

  if (payload.thumbnail) {
    const textWordCount = payload.thumbnail.selectedConcept.shortText.trim().split(/\s+/).length;
    if (textWordCount > 5) {
      issues.push({
        category: "metadata",
        severity: "low",
        message: `Thumbnail text is ${textWordCount} words; recommend 2 to 4 words for optimal mobile readability.`,
      });
      score -= 3;
    }
  }

  // Determine pass threshold
  const normalizedScore = Math.max(0, Math.min(100, score));
  const hasCritical = issues.some((i) => i.severity === "critical");
  const passed = normalizedScore >= 70 && !hasCritical;

  if (passed) {
    recommendations.push("Documentary package satisfies all Curioverse quality and editorial thresholds.");
  }

  const autoPublish = process.env.AUTO_PUBLISH === "true" ? false : false; // Strict safety constraint: AUTO_PUBLISH is false

  const approval: ApprovalPackage = {
    readyForReview: passed,
    autoPublish,
    status: passed ? "PENDING_HUMAN_REVIEW" : "REJECTED",
    notes: passed
      ? `Automated QA passed with score ${normalizedScore}/100. Ready for human editorial review prior to publication.`
      : `Automated QA flagged quality issues (score ${normalizedScore}/100). Review issues before proceeding.`,
  };

  return {
    qa: {
      passed,
      score: normalizedScore,
      issues,
      recommendations,
    },
    approval,
  };
}
