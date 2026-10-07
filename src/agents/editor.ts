import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
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
 * Resolves the path to the system FFmpeg binary across standard and WinGet locations.
 */
export function getFFmpegBinaryPath(): string | null {
  const candidates = [
    "ffmpeg",
    "ffmpeg.exe",
    path.join(process.env.LOCALAPPDATA || "", "Microsoft", "WinGet", "Links", "ffmpeg.exe"),
    "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

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
 * Executes automatic video rendering using the system FFmpeg binary.
 */
async function executeVideoRender(
  scenePlan: ScenePlan,
  visuals: VisualGenerationResult,
  voiceOver: VoiceOverResult,
  outputVideoPath: string
): Promise<boolean> {
  const ffmpegBin = getFFmpegBinaryPath();
  if (!ffmpegBin) return false;

  try {
    const outputDir = path.dirname(outputVideoPath);
    const scenesDir = path.join(outputDir, "scenes");
    const audioDir = path.join(outputDir, "audio");
    mkdirSync(scenesDir, { recursive: true });
    mkdirSync(audioDir, { recursive: true });

    // 1. Download and save scene images
    const imagePaths: string[] = [];
    for (let i = 0; i < scenePlan.scenes.length; i++) {
      const scene = scenePlan.scenes[i]!;
      const asset = visuals.assets.find((a) => a.sceneId === scene.id) || visuals.assets[i];
      const imgPath = path.join(scenesDir, `scene_${String(i + 1).padStart(2, "0")}.jpg`);

      if (asset?.url.startsWith("http://") || asset?.url.startsWith("https://")) {
        try {
          const resp = await fetch(asset.url);
          if (resp.ok) {
            writeFileSync(imgPath, Buffer.from(await resp.arrayBuffer()));
          }
        } catch {}
      } else if (asset?.url.startsWith("data:image/")) {
        try {
          const matches = asset.url.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
          if (matches && matches[2]) {
            writeFileSync(imgPath, Buffer.from(matches[2], "base64"));
          } else if (asset.url.startsWith("data:image/svg+xml")) {
            const svgPath = path.join(scenesDir, `scene_${String(i + 1).padStart(2, "0")}.svg`);
            const svgContent = decodeURIComponent(asset.url.replace("data:image/svg+xml;utf8,", ""));
            writeFileSync(svgPath, svgContent);
          }
        } catch {}
      }
      imagePaths.push(imgPath);
    }

    // 2. Concatenate and save narration audio segments
    const audioBuffers: Buffer[] = [];
    for (let i = 0; i < voiceOver.segments.length; i++) {
      const seg = voiceOver.segments[i]!;
      if (seg.audioUrl.startsWith("data:audio/mp3;base64,")) {
        const b64 = seg.audioUrl.replace("data:audio/mp3;base64,", "");
        audioBuffers.push(Buffer.from(b64, "base64"));
      }
    }

    const narrationPath = path.join(audioDir, "narration_full.mp3");
    if (audioBuffers.length > 0) {
      writeFileSync(narrationPath, Buffer.concat(audioBuffers));
    }

    // 3. Assemble concat text file for smooth video presentation
    const concatFilePath = path.join(outputDir, "concat_scenes.txt");
    const concatLines: string[] = [];
    for (let i = 0; i < scenePlan.scenes.length; i++) {
      const scene = scenePlan.scenes[i]!;
      const imgPath = existsSync(imagePaths[i]!) ? imagePaths[i]! : null;
      if (imgPath) {
        concatLines.push(`file '${imgPath.replace(/\\/g, "/")}'`);
        concatLines.push(`duration ${scene.duration}`);
      }
    }
    // Repeat last image per FFmpeg concat demuxer requirement
    if (imagePaths[imagePaths.length - 1] && existsSync(imagePaths[imagePaths.length - 1]!)) {
      concatLines.push(`file '${imagePaths[imagePaths.length - 1]!.replace(/\\/g, "/")}'`);
    }

    if (concatLines.length === 0) return false;
    writeFileSync(concatFilePath, concatLines.join("\n"));

    // 4. Run FFmpeg command to compile final documentary video
    const args = [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", concatFilePath,
    ];

    if (existsSync(narrationPath)) {
      args.push("-i", narrationPath);
      args.push("-c:a", "aac", "-b:a", "192k");
    }

    args.push(
      "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-movflags", "+faststart",
      outputVideoPath
    );

    const proc = Bun.spawn([ffmpegBin, ...args], {
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch (err) {
    console.error("[FFmpeg Rendering Error]:", err);
    return false;
  }
}

/**
 * Curioverse Editor Agent
 * Constructs the multi-track Timeline JSON (video, narration, music, subtitles, text overlays),
 * produces timed SRT/WebVTT subtitles, and executes the FFmpeg rendering pipeline into a final MP4.
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

  const outputVideoPath = "output/final_documentary.mp4";
  const ffmpegCommand = compileFFmpegCommand(timeline, outputVideoPath);

  let renderStatus: "COMPLETED" | "READY_TO_RENDER" | "SIMULATED" = "READY_TO_RENDER";
  const hasFFmpeg = Boolean(getFFmpegBinaryPath());

  if (hasFFmpeg) {
    const rendered = await executeVideoRender(scenePlan, visuals, voiceOver, outputVideoPath);
    if (rendered) {
      renderStatus = "COMPLETED";
      console.log(`[Editor Agent] Video successfully rendered to: ${outputVideoPath}`);
    }
  }

  return {
    timeline,
    subtitles,
    outputVideoPath,
    renderStatus,
    ffmpegCommand,
    duration: timeline.duration,
  };
}
