/**
 * Channel DNA definition for Curioverse.
 * Defines the persistent identity, editorial tone, visual tenets, and storytelling principles.
 */

export interface ChannelDNA {
  name: string;
  language: string;
  audience: string;
  niche: string;
  contentPillars: string[];
  tone: string[];
  visualStyle: string[];
  storytellingPrinciples: string[];
}

export const CHANNEL_DNA: ChannelDNA = {
  name: "Curioverse",
  language: "English",
  audience: "Global English-speaking audience (US, UK, Canada, Australia, New Zealand, and worldwide)",
  niche: "Curiosity-driven illustrated documentaries",
  contentPillars: [
    "Human Behavior / Psychology",
    "Science",
    "Space / Astronomy",
    "History / Historical Mysteries",
    "Geography / Strange Places",
    "Mythology / Folklore",
  ],
  tone: [
    "curious",
    "intelligent",
    "cinematic",
    "accessible",
    "thought-provoking",
  ],
  visualStyle: [
    "editorial illustration",
    "2D/2.5D perspective",
    "clean soft outlines",
    "soft cinematic lighting",
    "subtle paper/editorial texture",
    "controlled muted palette",
    "consistent character proportions",
    "subtle camera movement (slow zoom, pan, parallax)",
  ],
  storytellingPrinciples: [
    "HOOK",
    "QUESTION",
    "CONTEXT",
    "DISCOVERY",
    "EXPLANATION",
    "COMPLICATION",
    "PAYOFF",
    "REFLECTION",
  ],
};
