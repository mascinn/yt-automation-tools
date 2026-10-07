# Curioverse

Curioverse is an automated AI-powered YouTube content production system producing curiosity-driven, editorial illustrated documentaries.

## Current Status: Phase 7 — YouTube Upload & Production Pipeline

Curioverse executes an 11-agent/service production pipeline transforming a topic into verified research, an 8-stage documentary narration script, an editorial scene plan, 16:9 visual illustration assets, synchronized voice-over narration, timed subtitles, a multi-track FFmpeg timeline, curiosity-driven thumbnail concepts, optimized YouTube metadata, a multi-dimensional QA audit with human approval gating, and YouTube Data API v3 publishing:

```text
Topic
  ↓
Research Agent (Academic & Scientific Sources)
  ↓
Fact Checker Agent (Epistemic Status & Claim Certainty)
  ↓
Script Agent (8-Stage Storytelling Arc + Factual Safeguards)
  ↓
Scene Planner Agent (2D Editorial Scenes + Motion + Character Profiles)
  ↓
Visual Agent (16:9 Digital Illustration Assets)
  ↓
Voice Agent (Synchronized Voice-Over Audio Segments)
  ↓
Editor Agent (Timeline JSON + SRT/VTT Subtitles + FFmpeg Command)
  ↓
Thumbnail Agent (Curiosity Concepts + Mobile-Readable Artwork)
  ↓
Metadata Agent (Scored Titles + Chapters + Citations + SEO Tags)
  ↓
QA Agent & Human Approval Gate (Multi-Dimensional Audit + AUTO_PUBLISH=false)
  ↓
YouTube Agent & Publishing Gateway (OAuth2 + YouTube Data API v3)
  ↓
Distributed Video on YouTube (Private / Unlisted / Public)
```

---

## Getting Started

### Prerequisites
- [Bun](https://bun.sh) (v1.0+)

### Installation
```bash
bun install
```

### Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure your environment variables:
```env
PORT=3000

# Text / LLM Service Configuration
AI_PROVIDER=mock          # "openai" or "mock"
AI_API_KEY=               # Your OpenAI or OpenAI-compatible API key
AI_MODEL=gpt-4o-mini
AI_BASE_URL=https://api.openai.com/v1

# Image Generation Configuration
IMAGE_PROVIDER=mock       # "openai" (DALL-E 3) or "mock"
IMAGE_API_KEY=            # Your OpenAI Image API key
IMAGE_MODEL=dall-e-3
IMAGE_BASE_URL=https://api.openai.com/v1

# Voice / TTS Configuration
TTS_PROVIDER=mock         # "openai" or "mock"
TTS_API_KEY=              # Your TTS API key
TTS_MODEL=tts-1
TTS_VOICE=onyx            # "onyx" (warm, deep narrative tone), "alloy", etc.
TTS_BASE_URL=https://api.openai.com/v1

# Publishing Safety
AUTO_PUBLISH=false        # Always false by default; requires human approval

# YouTube Configuration
YOUTUBE_PROVIDER=mock     # "google" (official YouTube Data API v3) or "mock"
YOUTUBE_CLIENT_ID=        # Google OAuth Client ID
YOUTUBE_CLIENT_SECRET=    # Google OAuth Client Secret
YOUTUBE_REFRESH_TOKEN=    # Google OAuth Refresh Token
YOUTUBE_ACCESS_TOKEN=     # Optional direct access token
DEFAULT_PRIVACY_STATUS=private # "private", "unlisted", or "public"
```

> **Note:** If API keys are omitted, Curioverse automatically falls back to deterministic mock generators for instant offline testing and development.

### Running Locally
```bash
bun run dev
```

The server will start at `http://localhost:3000`.

### Running Tests
```bash
bun test
```

---

## API Reference

### 1. Generate Content Pipeline
**Endpoint:** `POST /api/content/generate`

**Request:**
```json
{
  "topic": "Why do humans dream?"
}
```

**Response:**
```json
{
  "topic": "Why do humans dream?",
  "research": { ... },
  "sources": [ ... ],
  "factCheck": { ... },
  "script": { ... },
  "sections": [ ... ],
  "scenePlan": { ... },
  "scenes": [ ... ],
  "characters": [ ... ],
  "visuals": { ... },
  "assets": [ ... ],
  "voiceOver": { ... },
  "audioSegments": [ ... ],
  "render": { ... },
  "timeline": { ... },
  "subtitles": { ... },
  "thumbnail": {
    "selectedConcept": {
      "id": "thumb-concept-01",
      "shortText": "WHY IN THE DARK?",
      "visualPrompt": "Editorial 2D illustration...",
      "curiosityHook": "Focuses on the paradox of hyperactive brain activity...",
      "imageUrl": "data:image/svg+xml;utf8,..."
    },
    "concepts": [ ... ]
  },
  "metadata": {
    "title": "The Architecture of Nightmares: Why Your Brain Still Dreams",
    "titleCandidates": [
      {
        "title": "The Architecture of Nightmares: Why Your Brain Still Dreams",
        "curiosityScore": 94,
        "accuracyScore": 97,
        "clickabilityScore": 91
      }
    ],
    "description": "Every night when you close your eyes...\n\nChapters:\n00:00 Introduction\n...\n\nSources & References:\n...",
    "tags": ["curioverse", "neuroscience", "dreams", "psychology"],
    "hashtags": ["#Curioverse", "#Documentary", "#Neuroscience"],
    "category": "Education",
    "categoryId": "27",
    "language": "en",
    "chapters": [
      { "title": "Hook: Every night...", "timestamp": "00:00", "seconds": 0 }
    ]
  },
  "qa": {
    "passed": true,
    "score": 95,
    "issues": [ ... ],
    "recommendations": [ ... ]
  },
  "approval": {
    "readyForReview": true,
    "autoPublish": false,
    "status": "PENDING_HUMAN_REVIEW",
    "notes": "Automated QA passed with score 95/100. Ready for human editorial review prior to publication."
  },
  "estimatedDuration": 405
}
```

### 2. Publish Content Gateway
**Endpoint:** `POST /api/content/publish`

Distributes vetted content packages or standalone video assets to YouTube via official Google YouTube Data API v3 (or mock simulator).

> **Safety Gate:** Requires explicit human approval. If `humanApproved: true` is not provided or `approval.status !== "APPROVED"`, the gateway rejects the request with HTTP `403 Forbidden`. If `AUTO_PUBLISH=false`, requested `PUBLIC` uploads are automatically downgraded to `PRIVATE` or `UNLISTED`.

**Request (Full approved package or direct):**
```json
{
  "videoPath": "./output/video.mp4",
  "title": "The Architecture of Nightmares: Why Your Brain Still Dreams",
  "description": "Every night when you close your eyes...\n\nChapters:\n00:00 Introduction",
  "tags": ["curioverse", "neuroscience", "dreams"],
  "categoryId": "27",
  "thumbnailPathOrUrl": "https://example.com/thumb.jpg",
  "privacyStatus": "PRIVATE",
  "humanApproved": true
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "videoId": "curio_thearchi_tmiz0a",
    "videoUrl": "https://youtu.be/curio_thearchi_tmiz0a",
    "title": "The Architecture of Nightmares: Why Your Brain Still Dreams",
    "privacyStatus": "PRIVATE",
    "thumbnailUploaded": true,
    "thumbnailUrl": "https://example.com/thumb.jpg",
    "uploadTime": "2026-10-07T06:05:00.000Z",
    "channelId": "UC_CurioverseMockChannel",
    "status": "SIMULATED"
  }
}
```

---

## Project Memory
Curioverse maintains persistent context across agent sessions:
- `PROJECT.md` — Channel DNA, audience, visual identity, long-term roadmap.
- `STATUS.md` — Current execution phase, completed tasks, and what is next.
- `DECISIONS.md` — Architectural decisions and technical constraints.
- `TODO.md` — Incremental task tracking.
