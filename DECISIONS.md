# Architectural Decisions

## DECISION-001: Runtime & Package Manager
- **Decision:** Bun (`bun`)
- **Rationale:** High-performance TypeScript-native runtime, fast package manager, native HTTP server support, and built-in test runner.
- **Rules:** No Node-specific tooling unless technically required.

## DECISION-002: Programming Language & Strictness
- **Decision:** TypeScript with strict type-checking enabled (`strict: true`).
- **Rationale:** Ensures reliability, strong contracts across multi-agent pipelines, and eliminates runtime typing errors. Avoid `any`; use `unknown` with runtime parsing/validation for AI outputs.

## DECISION-003: API Framework
- **Decision:** Hono
- **Rationale:** Lightweight, fast, web-standard-based router that integrates seamlessly with Bun's native `Bun.serve`.

## DECISION-004: AI Service Abstraction Layer
- **Decision:** Define an `AIService` interface decoupling agents from specific AI provider SDKs.
- **Rationale:** Enables hot-swapping between AI models (OpenAI, OpenRouter, Gemini, Groq, Ollama) and supports deterministic mock services for offline testing and continuous integration without API credentials.

## DECISION-005: Phase-Based Incremental Delivery
- **Decision:** Strictly build phase-by-phase. Stop upon completing the current phase and await user review.
- **Rationale:** Prevents scope creep, premature architectural debt, and unnecessary complexity.

## DECISION-006: Human Approval & Publishing Safety
- **Decision:** `AUTO_PUBLISH=false` as the default permanent setting across all configurations.
- **Rationale:** Protects channel integrity by requiring human QA and review before any video or metadata reaches YouTube.

## DECISION-007: Epistemic Status & Claim Verification (Phase 2)
- **Decision:** Categorize research claims using 6 strict epistemic statuses: `OBSERVED`, `ESTABLISHED`, `THEORY`, `HYPOTHESIS`, `SPECULATION`, and `FICTIONAL_SCENARIO`.
- **Rationale:** Prevents speculative hypotheses (e.g. in psychology, evolutionary biology, astronomy) from being asserted as settled fact in the script narration.

## DECISION-008: Editorial Illustrated Scene Planning (Phase 2)
- **Decision:** Represent visual pacing as curated 8–25 second scenes rather than 1 image per sentence, utilizing typed scene categories (`character scene`, `environment`, `diagram`, `map`, `timeline`, `statistic`, `quote`, `comparison`, `process`, `cosmic scale`, `transition`), camera motion plans (`slow-zoom-in`, `pan-left`, `parallax`, etc.), and recurring character profiles for continuity.
- **Rationale:** Guarantees visual unity adhering to the Curioverse Editorial Illustrated style before any image generation APIs are invoked in Phase 3.

## DECISION-009: Image Service Abstraction & Visual Prompt Compilation (Phase 3)
- **Decision:** Define a decoupled `ImageService` interface supporting DALL-E 3 (`OpenAIImageService`) and offline SVG vector asset generation (`MockImageService`). Compile visual prompts by assembling scene visual details, character profiles, camera perspective (2D/2.5D), muted palette guidelines, and negative constraints (preventing 3D renders, anime, or photorealism).
- **Rationale:** Ensures visual generation is completely independent of specific image vendors and enables instant, zero-cost deterministic previews in test and offline workflows.

## DECISION-010: Voice Service Abstraction & Audio Segmentation (Phase 4)
- **Decision:** Define a decoupled `VoiceService` interface supporting OpenAI TTS (`OpenAIVoiceService`, voice: `onyx`) and deterministic mock audio generation (`MockVoiceService`). Segment audio narration per script section while calculating spoken duration at documentary pace (~135 wpm / 2.25 words per sec), synchronizing segments to planned scene IDs and retrying failed generations up to 2 times.
- **Rationale:** Keeps audio generation independent of specific TTS providers and produces synchronized audio timestamps essential for timeline composition in Phase 5.

## DECISION-011: Multi-Track Timeline Architecture & FFmpeg Pipeline (Phase 5)
- **Decision:** Represent rendering as a declarative `Timeline` schema containing 5 distinct tracks: `video`, `narration`, `music` (ducked to 0.15 volume), `subtitles`, and `text` overlay. Subtitles are compiled to both `.srt` and `.vtt` formats derived from narration audio segment pacing. Camera motion plans translate directly into FFmpeg `zoompan` filter complex chains for headless, repeatable command compilation without desktop GUI dependencies.
- **Rationale:** Guarantees standard video composition without relying on fragile GUI automation (such as CapCut macros) and establishes a headless rendering foundation for automated production.

## DECISION-012: Automated QA Inspection & Human Approval Gate (Phase 6)
- **Decision:** Implement a multi-dimensional QA engine evaluating research citations, script narration clichés, 16:9 visual aspect ratios, audio narration segment alignment, timeline dimension standards (1920x1080), and YouTube metadata character boundaries. Enforce a mandatory human review gate (`AUTO_PUBLISH=false`) assigning status `PENDING_HUMAN_REVIEW` before any publication can occur in Phase 7.
- **Rationale:** Protects channel reputation and editorial standards by ensuring every generated asset is systematically audited and human-approved prior to YouTube distribution.

## DECISION-013: YouTube Data API Service & Secure Publishing Protocol (Phase 7)
- **Decision:** Implement a decoupled `YouTubeService` abstraction featuring `GoogleYouTubeService` (interacting with the official YouTube Data API v3 resumable upload endpoints and OAuth2 refresh flows) and `MockYouTubeService` (for deterministic zero-dependency tests). Coordinate publishing via `youtubeAgent` which strictly validates human review approval (`approval.status === "APPROVED"` or `humanApproved: true`), packages video assets, metadata, category 27, and thumbnail images, and applies an automated fallback safeguard downgrading `PUBLIC` requests to `PRIVATE` or `UNLISTED` whenever `AUTO_PUBLISH=false`.
- **Rationale:** Eliminates fragile browser macros or GUI scrapers in favor of official, auditable Google APIs, while preventing unvetted automated public releases through strict human approval enforcement and configuration safeguards.

