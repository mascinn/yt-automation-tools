import type { AudioSegment, SubtitleCue, SubtitlePackage } from "../types/content.ts";

/**
 * Formats seconds into SRT timestamp string: HH:MM:SS,mmm
 */
export function formatSRTTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

/**
 * Formats seconds into WebVTT timestamp string: HH:MM:SS.mmm
 */
export function formatVTTTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

/**
 * Splits a section's narration text into readable subtitle sentences or phrases (~6–10 words each)
 * and distributes the audio segment duration proportionally across them.
 */
export function generateSubtitlesFromAudioSegments(segments: AudioSegment[]): SubtitlePackage {
  const cues: SubtitleCue[] = [];
  let currentOffset = 0;
  let cueIndex = 1;

  for (const seg of segments) {
    // Split narration into sentence chunks
    const sentences = seg.text
      .split(/(?<=[.?!;])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const validSentences = sentences.length > 0 ? sentences : [seg.text];
    const totalWords = validSentences.reduce((acc, s) => acc + s.split(/\s+/).length, 0);

    let segTime = currentOffset;
    for (const sentence of validSentences) {
      const sentenceWords = sentence.split(/\s+/).length;
      const sentenceDuration = totalWords > 0
        ? Math.max(1.5, Number(((sentenceWords / totalWords) * seg.duration).toFixed(2)))
        : seg.duration;

      const startTime = Number(segTime.toFixed(2));
      const endTime = Number((segTime + sentenceDuration).toFixed(2));

      cues.push({
        id: cueIndex++,
        startTime,
        endTime,
        text: sentence,
      });

      segTime += sentenceDuration;
    }

    currentOffset += seg.duration;
  }

  // Generate SRT content
  const srt = cues
    .map(
      (cue) =>
        `${cue.id}\n${formatSRTTime(cue.startTime)} --> ${formatSRTTime(cue.endTime)}\n${cue.text}\n`
    )
    .join("\n");

  // Generate WebVTT content
  const vtt = [
    "WEBVTT",
    "",
    ...cues.map(
      (cue) =>
        `${cue.id}\n${formatVTTTime(cue.startTime)} --> ${formatVTTTime(cue.endTime)}\n${cue.text}\n`
    ),
  ].join("\n");

  return {
    srt,
    vtt,
    cues,
  };
}
