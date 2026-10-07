# Project Tasks & Roadmap

## Phase 1 — Research + Script (COMPLETED)
- [x] Bun project initialization & dependencies (`hono`)
- [x] Persistent project memory files (`PROJECT.md`, `DECISIONS.md`, `TODO.md`, `STATUS.md`)
- [x] TypeScript types definition (`src/types/content.ts`)
- [x] Channel DNA configuration (`src/config/channel.ts`)
- [x] AI Service Abstraction (`src/services/ai.ts`)
- [x] Research Agent implementation (`src/agents/research.ts`)
- [x] Script Agent implementation (`src/agents/script.ts`)
- [x] Content generation route `POST /api/content/generate` (`src/routes/content.ts`)
- [x] Main Hono server setup (`src/index.ts`)
- [x] Environment files (`.env`, `.env.example`)
- [x] Automated testing suite (`tests/content.test.ts`)
- [x] Verification with `bun test` and live HTTP calls
- [x] Update `STATUS.md` and handoff report

---

## Phase 2 — Fact Checker + Scene Planner (COMPLETED)
- [x] Fact Checker Agent (`src/agents/fact_checker.ts`)
- [x] Claim status classification (`OBSERVED`, `ESTABLISHED`, `THEORY`, `HYPOTHESIS`, `SPECULATION`, `FICTIONAL_SCENARIO`)
- [x] Script Agent integration with fact-checking qualification and flagged claim guidance
- [x] Scene Planner Agent (`src/agents/scene_planner.ts`)
- [x] Scene types, visual prompts, motion plans, and character continuity profiles
- [x] Integrated pipeline in `POST /api/content/generate`
- [x] Extended automated test suite (9 passing tests, 64 assertions)
- [x] Update persistent memory files (`STATUS.md`, `DECISIONS.md`, `TODO.md`, `README.md`)

---

## Phase 3 — Visual Generation (COMPLETED)
- [x] Image Service Abstraction (`src/services/image.ts`) supporting OpenAI/DALL-E 3 and MockImageService
- [x] Visual Agent (`src/agents/visual.ts`)
- [x] Editorial Illustrated prompt compiler with character anchors and negative constraints
- [x] 16:9 widescreen asset generation pipeline
- [x] Integrated visual generation into `POST /api/content/generate`
- [x] Extended automated test suite (10 passing tests, 78 assertions)
- [x] Update persistent memory files (`STATUS.md`, `DECISIONS.md`, `TODO.md`, `README.md`)

---

## Phase 4 — Voice (COMPLETED)
- [x] Voice Service Abstraction (`src/services/voice.ts`) supporting OpenAI TTS and MockVoiceService
- [x] Voice Agent (`src/agents/voice.ts`) with retry and natural cadence pacing
- [x] Audio segmentation and scene timing synchronization
- [x] Integrated voice generation into `POST /api/content/generate`
- [x] Extended automated test suite (11 passing tests, 90 assertions)
- [x] Update persistent memory files (`STATUS.md`, `DECISIONS.md`, `TODO.md`, `README.md`)

---

## Phase 5 — Video Rendering (COMPLETED)
- [x] Subtitles Service (`src/services/subtitles.ts`) with SRT and WebVTT generation
- [x] Editor Agent (`src/agents/editor.ts`)
- [x] Multi-track Timeline JSON (video, narration, ducked music, text overlay)
- [x] FFmpeg command line composition with zoompan camera motion filters
- [x] Integrated rendering pipeline into `POST /api/content/generate`
- [x] Extended automated test suite (13 passing tests, 119 assertions)
- [x] Update persistent memory files (`STATUS.md`, `DECISIONS.md`, `TODO.md`, `README.md`)

---

## Phase 6 — Thumbnail + Metadata + QA (COMPLETED)
- [x] Thumbnail Agent (`src/agents/thumbnail.ts`) with mobile-readable text and artwork generation
- [x] Title Agent / Candidate generator with curiosity, accuracy, and clickability scores
- [x] Metadata Agent (`src/agents/metadata.ts`) with description, citations, tags, hashtags, and timestamped chapters
- [x] QA Agent (`src/agents/qa.ts`) inspecting research, script clichés, visuals, audio, video timeline, and metadata
- [x] Human Approval workflow enforcing `AUTO_PUBLISH=false`
- [x] Extended automated test suite (15 passing tests)
- [x] Update persistent memory files (`STATUS.md`, `DECISIONS.md`, `TODO.md`, `README.md`)

---

## Phase 7 — YouTube Upload (COMPLETED)
- [x] YouTube Service abstraction (`src/services/youtube.ts`) supporting `GoogleYouTubeService` (YouTube Data API v3 resumable uploads & OAuth2 refresh) and `MockYouTubeService`
- [x] Safety guardrails enforcing `AUTO_PUBLISH=false` and automatic privacy fallback (`PUBLIC` -> `PRIVATE`/`UNLISTED`)
- [x] YouTube Agent (`src/agents/youtube.ts`) validating human review approval status
- [x] Packaging video assets, metadata, category 27, and custom thumbnail
- [x] Dedicated publishing route `POST /api/content/publish` with human approval verification (`403` if blocked, `200` upon approval)
- [x] Extended automated test suite (25 passing tests, 106 assertions)
- [x] Update persistent memory files (`STATUS.md`, `DECISIONS.md`, `TODO.md`, `README.md`)

