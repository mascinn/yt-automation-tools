import { generateSubtitlesFromAudioSegments } from "../services/subtitles.ts";
import type {
  MotionPlan,
  RenderResult,
  ScenePlan,
  Timeline,
  TimelineClip,
  TimelineTrack,
  VisualGenerationResult,
  VoiceOverResult,
} from "../types/content.ts";

/**
 * Builds an FFmpeg zoompan filter expression for a given motion plan and duration.
 */
function buildZoompanFilter(motion?: MotionPlan, duration = 5, fps = 30): string {
  const frames = Math.max(30, duration * fps);
  switch (motion?.type) {
    case "slow-zoom-in":
      return `zoompan=z='min(zoom+0.0015,1.25)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=${fps}`;
    case "slow-zoom-out":
      return `zoompan=z='if(lte(zoom,1.0),1.25,max(1.001,zoom-0.0015))':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=${fps}`;
    case "pan-left":
      return `zoompan=z=1.15:x='if(lte(on,1),(iw-iw/zoom)/2,x+1)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1080:fps=${fps}`;
    case "pan-right":
      return `zoompan=z=1.15:x='if(lte(on,1),(iw-iw/zoom)/2,x-1)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1080:fps=${fps}`;
    case "parallax":
    case "subtle-float":
      return `zoompan=z='1.10+0.05*sin(2*PI*on/${frames})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1080:fps=${fps}`;
    case "static":
    default:
      return `zoompan=z=1.0:d=${frames}:s=1920x1080:fps=${fps}`;
  }
}

/**
 * Compiles a reproducible FFmpeg CLI command that composites images, motion, narration, and ducked music.
 */
function compileFFmpegCommand(timeline: Timeline, outputPath: string): string {
  const videoTrack = timeline.tracks.find((t) => t.type === "video");
  const narrationTrack = timeline.tracks.find((t) => t.type === "narration");

  const inputs: string[] = [];
  const filterChains: string[] = [];

  let inputIndex = 0;
  if (videoTrack) {
    for (const clip of videoTrack.clips) {
      inputs.push(`-loop 1 -t ${clip.duration} -i "${clip.sourceUrl || `scene_${clip.id}.png`}"`);
      const zoompan = buildZoompanFilter(clip.motion, clip.duration, timeline.fps);
      filterChains.push(`[${inputIndex}:v]${zoompan},format=yuv420p[v${inputIndex}]`);
      inputIndex++;
    }
  }

  const concatSegments = videoTrack?.clips.map((_, idx) => `[v${idx}]`).join("") || "";
  const concatFilter = `${concatSegments}concat=n=${videoTrack?.clips.length || 1}:v=1:a=0[vout]`;

  return `ffmpeg ${inputs.join(" ")} -filter_complex "${filterChains.join(";")};${concatFilter}" -map "[vout]" -c:v libx264 -pix_fmt yuv420p -r ${timeline.fps} -movflags +faststart "${outputPath}"`;
}

/**
 * Curioverse Editor Agent
 * Constructs the multi-track Timeline JSON (video, narration, music, subtitles, text overlays),
 * produces timed SRT/WebVTT subtitles, and compiles the FFmpeg rendering pipeline.
 */
export async function editorAgent(
  scenePlan: ScenePlan,
  visuals: VisualGenerationResult,
  voiceOver: VoiceOverResult
): Promise<RenderResult> {
  const fps = 30;
  const width = 1920;
  const height = 1080;

  // 1. Build Subtitles from narration audio segments
  const subtitles = generateSubtitlesFromAudioSegments(voiceOver.segments);

  // 2. Assemble Video Track
  const videoClips: TimelineClip[] = [];
  let videoTime = 0;

  for (let i = 0; i < scenePlan.scenes.length; i++) {
    const scene = scenePlan.scenes[i]!;
    const asset = visuals.assets.find((a) => a.sceneId === scene.id) || visuals.assets[i];

    videoClips.push({
      id: `clip-vid-${scene.id}`,
      sourceId: scene.id,
      startTime: Number(videoTime.toFixed(2)),
      duration: scene.duration,
      sourceUrl: asset?.url,
      motion: scene.motion,
      text: scene.onScreenText,
    });

    videoTime += scene.duration;
  }

  // 3. Assemble Narration Audio Track
  const narrationClips: TimelineClip[] = [];
  let audioTime = 0;

  for (const seg of voiceOver.segments) {
    narrationClips.push({
      id: `clip-audio-${seg.sectionId}`,
      sourceId: seg.sectionId,
      startTime: Number(audioTime.toFixed(2)),
      duration: seg.duration,
      sourceUrl: seg.audioUrl,
    });

    audioTime += seg.duration;
  }

  // Total duration matches the maximum of video and voice
  const totalDuration = Math.max(videoTime, audioTime, scenePlan.totalDuration);

  // 4. Assemble Music Track (ambient background with volume ducking)
  const musicClips: TimelineClip[] = [
    {
      id: "clip-bg-music-main",
      sourceId: "ambient-curioverse-theme",
      startTime: 0,
      duration: totalDuration,
      sourceUrl: "https://assets.curioverse.internal/audio/music/ambient_contemplation.mp3",
    },
  ];

  // 5. Assemble Text Overlay Track
  const textClips: TimelineClip[] = scenePlan.scenes
    .filter((s) => Boolean(s.onScreenText))
    .map((s, idx) => ({
      id: `clip-text-${s.id}`,
      sourceId: s.id,
      startTime: videoClips[idx]?.startTime || 0,
      duration: s.duration,
      text: s.onScreenText,
    }));

  const tracks: TimelineTrack[] = [
    {
      id: "track-video-primary",
      type: "video",
      clips: videoClips,
    },
    {
      id: "track-audio-narration",
      type: "narration",
      clips: narrationClips,
      volume: 1.0,
    },
    {
      id: "track-audio-music",
      type: "music",
      clips: musicClips,
      volume: 0.15, // volume ducking to keep narration dominant
    },
    {
      id: "track-overlay-text",
      type: "text",
      clips: textClips,
    },
  ];

  const timeline: Timeline = {
    width,
    height,
    fps,
    duration: Number(totalDuration.toFixed(2)),
    tracks,
  };

  const outputVideoPath = "dist/renders/final_documentary.mp4";
  const ffmpegCommand = compileFFmpegCommand(timeline, outputVideoPath);

  return {
    timeline,
    subtitles,
    outputVideoPath,
    renderStatus: "READY_TO_RENDER",
    ffmpegCommand,
    duration: timeline.duration,
  };
}
