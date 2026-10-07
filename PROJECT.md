# Curioverse

## 1. Project Purpose
Curioverse is an automated AI-powered YouTube content production system designed to transform a simple curiosity-driven topic or idea into a complete illustrated documentary video (6–12 minutes) and eventually publish it to YouTube.

## 2. Channel Identity
- **Name:** Curioverse
- **Niche:** Curiosity-driven illustrated documentaries
- **Core Promise:** "Discover something you never knew you wanted to know."
- **Internal Positioning:** "Wait... why is that?"
- **Format:** 6–12 minute narrated illustrated documentaries
- **Core Structure:** Curiosity → Story → Explanation → Illustration
- **Target Audience:** Global English-speaking audience (US, UK, Canada, Australia, New Zealand, and global English speakers)
- **Content Pillars:**
  - Human Behavior / Psychology
  - Science
  - Space / Astronomy
  - History / Historical Mysteries
  - Geography / Strange Places
  - Mythology / Folklore

## 3. Visual Identity
- **Style:** Editorial Illustrated Documentary
- **Technique:** 2D digital illustration, 2D/2.5D perspective
- **Composition & Lighting:** Simple cinematic composition, clean soft outlines, soft cinematic lighting, subtle paper/editorial texture, controlled muted palette
- **Characters:** Simple human characters with consistent proportions across scenes
- **Motion:** Subtle camera movement (slow zoom, pan, parallax, subtle object movement)
- **Rules:** Narration is the backbone. Visuals support rather than overpower. Avoid photorealism, anime, childish cartoon aesthetics, 3D cartoons, hyper-saturation, and random styles.

## 4. Multi-Agent Architecture (Target)
```text
                    ORCHESTRATOR
                         |
        +----------------+----------------+
        |                |                |
   RESEARCH AGENT   ANGLE AGENT      TITLE AGENT
        |
   FACT CHECKER
        |
   SCRIPT AGENT
        |
   SCENE PLANNER
        |
   +----+---------+
   |              |
VISUAL AGENT   VOICE AGENT
   |              |
   +------+-------+
          |
      EDITOR AGENT
          |
      SUBTITLE AGENT
          |
    +-----+------+
    |            |
THUMBNAIL     METADATA
  AGENT        AGENT
    |            |
    +-----+------+
          |
        QA AGENT
          |
    HUMAN APPROVAL
          |
    YOUTUBE AGENT
          |
    UPLOAD / SCHEDULE
```

> **Rule:** Agent ≠ model. Agents are modular software responsibilities that can use one or more replaceable AI models and tools.

## 5. Technology Stack
- **Runtime:** Bun
- **Language:** TypeScript
- **API Framework:** Hono
- **AI Abstraction:** Replaceable AI Service interface (`AIService`)
- **Future Technologies (Phase 2+):** PostgreSQL, Redis, FFmpeg, TTS, Image Generation API, YouTube Data API + OAuth

## 6. Permanent Constraints & Development Principles
1. **Strictly Phase-Based:** Never jump ahead to future phases. Stop and report upon phase completion.
2. **Decoupled AI Providers:** Agents never depend directly on a specific AI provider SDK; all calls route through the abstracted `AIService`.
3. **Strict TypeScript:** No unnecessary `any`; prefer validated `unknown` for external and AI responses.
4. **Human Approval:** Publishing default is `AUTO_PUBLISH=false`.
5. **Project Memory Integrity:** Maintain `PROJECT.md`, `STATUS.md`, `DECISIONS.md`, and `TODO.md` across sessions.
