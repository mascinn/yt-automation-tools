/**
 * Core type definitions for Curioverse content pipeline.
 */

export type FactualStatus =
  | "OBSERVED"
  | "ESTABLISHED"
  | "THEORY"
  | "HYPOTHESIS"
  | "SPECULATION"
  | "FICTIONAL_SCENARIO";

export interface Source {
  title: string;
  url: string;
  publisher?: string;
  date?: string;
}

export interface ResearchPoint {
  claim: string;
  explanation: string;
  importance: string;
}

export interface ResearchResult {
  topic: string;
  summary: string;
  keyPoints: ResearchPoint[];
  sources: Source[];
  uncertainties: string[];
}

export interface Claim {
  text: string;
  status: FactualStatus;
  sources: string[];
  confidence: number; // 0.0 to 1.0
}

export interface FlaggedClaim {
  claim: string;
  reason: string;
  guidanceForScript: string;
}

export interface FactCheckResult {
  overallStatus: "VERIFIED" | "QUALIFIED" | "FLAGGED";
  claims: Claim[];
  flaggedClaims: FlaggedClaim[];
  notes: string;
}

export interface ScriptSection {
  id: string;
  narration: string;
  purpose: string;
  estimatedDuration: number; // in seconds
}

export interface VideoScript {
  title: string;
  hook: string;
  sections: ScriptSection[];
  estimatedDuration: number; // in seconds
  closing: string;
}

export type SceneType =
  | "character scene"
  | "environment"
  | "diagram"
  | "map"
  | "timeline"
  | "statistic"
  | "quote"
  | "comparison"
  | "process"
  | "cosmic scale"
  | "transition";

export interface MotionPlan {
  type: "slow-zoom-in" | "slow-zoom-out" | "pan-left" | "pan-right" | "parallax" | "static" | "subtle-float";
  speed: "slow" | "medium";
  focusPoint?: string;
}

export interface CharacterProfile {
  id: string;
  name: string;
  appearance: string;
  clothing: string;
  proportions: string;
  personality: string;
}

export interface Scene {
  id: string;
  duration: number; // in seconds
  narration: string;
  sceneType: SceneType;
  visualPrompt: string;
  characters: string[];
  background: string;
  motion: MotionPlan;
  onScreenText?: string;
}

export interface ScenePlan {
  scenes: Scene[];
  characters: CharacterProfile[];
  totalDuration: number;
  visualStyleGuide: string;
}

export interface VisualAsset {
  sceneId: string;
  prompt: string;
  styleApplied: string;
  aspectRatio: "16:9" | "9:16" | "1:1";
  url: string;
  format: "png" | "jpg" | "webp" | "svg";
  status: "GENERATED" | "CACHED" | "MOCK";
}

export interface VisualGenerationResult {
  assets: VisualAsset[];
  styleGuide: string;
  totalGenerated: number;
}

export interface AudioSegment {
  sectionId: string;
  sceneId?: string;
  text: string;
  duration: number; // in seconds
  audioUrl: string;
  format: "mp3" | "wav" | "aac" | "mock-audio";
  status: "GENERATED" | "MOCK";
}

export interface VoiceOverResult {
  voiceId: string;
  voiceStyle: string;
  segments: AudioSegment[];
  totalDuration: number; // in seconds
  fullAudioUrl?: string;
}

export type TrackType = "video" | "narration" | "music" | "subtitles" | "text";

export interface TimelineClip {
  id: string;
  sourceId: string;
  startTime: number; // in seconds
  duration: number; // in seconds
  sourceUrl?: string;
  motion?: MotionPlan;
  text?: string;
}

export interface TimelineTrack {
  id: string;
  type: TrackType;
  clips: TimelineClip[];
  volume?: number;
}

export interface Timeline {
  width: number;
  height: number;
  fps: number;
  duration: number;
  tracks: TimelineTrack[];
}

export interface SubtitleCue {
  id: number;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
}

export interface SubtitlePackage {
  srt: string;
  vtt: string;
  cues: SubtitleCue[];
}

export interface RenderResult {
  timeline: Timeline;
  subtitles: SubtitlePackage;
  outputVideoPath: string;
  renderStatus: "COMPLETED" | "READY_TO_RENDER" | "SIMULATED";
  ffmpegCommand: string;
  duration: number;
}

export interface ThumbnailConcept {
  id: string;
  shortText: string;
  visualPrompt: string;
  curiosityHook: string;
  imageUrl?: string;
}

export interface ThumbnailResult {
  concepts: ThumbnailConcept[];
  selectedConcept: ThumbnailConcept;
}

export interface TitleCandidate {
  title: string;
  curiosityScore: number;
  accuracyScore: number;
  clickabilityScore: number;
}

export interface VideoChapter {
  title: string;
  timestamp: string; // HH:MM:SS or MM:SS
  seconds: number;
}

export interface VideoMetadata {
  title: string;
  titleCandidates: TitleCandidate[];
  description: string;
  tags: string[];
  hashtags: string[];
  category: string;
  categoryId: string;
  language: string;
  chapters: VideoChapter[];
}

export interface QAIssue {
  category: "research" | "script" | "visuals" | "audio" | "video" | "metadata";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
}

export interface QAResult {
  passed: boolean;
  score: number; // 0 to 100
  issues: QAIssue[];
  recommendations: string[];
}

export interface ApprovalPackage {
  readyForReview: boolean;
  autoPublish: boolean;
  status: "PENDING_HUMAN_REVIEW" | "APPROVED" | "REJECTED";
  notes: string;
}

export type PublicationStatus = "PRIVATE" | "UNLISTED" | "PUBLIC" | "SCHEDULED";

export interface YouTubePublishPackage {
  videoPath: string;
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  privacyStatus: PublicationStatus;
  publishAt?: string; // ISO 8601 string for scheduled release
  thumbnailPathOrUrl?: string;
  defaultLanguage?: string;
  defaultAudioLanguage?: string;
}

export interface YouTubeUploadResult {
  videoId: string;
  videoUrl: string;
  title: string;
  privacyStatus: PublicationStatus;
  scheduledPublishTime?: string;
  thumbnailUploaded: boolean;
  thumbnailUrl?: string;
  uploadTime: string;
  channelId?: string;
  status: "SUCCESS" | "FAILED" | "SIMULATED";
  safetyNotes?: string[];
}

export interface PublishContentRequest {
  render?: RenderResult;
  thumbnail?: ThumbnailResult;
  metadata?: VideoMetadata;
  approval?: ApprovalPackage;
  videoPath?: string;
  title?: string;
  description?: string;
  tags?: string[];
  categoryId?: string;
  thumbnailPathOrUrl?: string;
  privacyStatus?: PublicationStatus;
  scheduledPublishTime?: string;
  humanApproved?: boolean;
}

export interface PublishContentResponse {
  success: boolean;
  result?: YouTubeUploadResult;
  error?: string;
  message?: string;
}

export interface YouTubeService {
  uploadVideo(pkg: YouTubePublishPackage): Promise<YouTubeUploadResult>;
  setThumbnail(videoId: string, thumbnailPathOrUrl: string): Promise<boolean>;
}

export interface GenerateContentRequest {
  topic: string;
}

export interface GenerateContentResponse {
  topic: string;
  research: ResearchResult;
  sources: Source[];
  factCheck?: FactCheckResult;
  script: VideoScript;
  sections: ScriptSection[];
  scenePlan?: ScenePlan;
  scenes?: Scene[];
  characters?: CharacterProfile[];
  visuals?: VisualGenerationResult;
  assets?: VisualAsset[];
  voiceOver?: VoiceOverResult;
  audioSegments?: AudioSegment[];
  render?: RenderResult;
  timeline?: Timeline;
  subtitles?: SubtitlePackage;
  thumbnail?: ThumbnailResult;
  metadata?: VideoMetadata;
  qa?: QAResult;
  approval?: ApprovalPackage;
  estimatedDuration: number;
}

export interface GenerateTextInput {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  responseFormat?: "json" | "text";
}

export interface GenerateTextOutput {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface AIService {
  generateText(input: GenerateTextInput): Promise<GenerateTextOutput>;
}

export interface GenerateImageInput {
  prompt: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  style?: string;
}

export interface GenerateImageOutput {
  url: string;
  format?: "png" | "jpg" | "webp" | "svg";
  revisedPrompt?: string;
}

export interface ImageService {
  generateImage(input: GenerateImageInput): Promise<GenerateImageOutput>;
}

export interface GenerateSpeechInput {
  text: string;
  voice?: string;
  speed?: number;
}

export interface GenerateSpeechOutput {
  audioUrl: string;
  duration: number; // in seconds
  format?: "mp3" | "wav" | "aac" | "mock-audio";
}

export interface VoiceService {
  generateSpeech(input: GenerateSpeechInput): Promise<GenerateSpeechOutput>;
}
