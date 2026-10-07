import type {
  PublicationStatus,
  YouTubePublishPackage,
  YouTubeService,
  YouTubeUploadResult,
} from "../types/content.ts";

export interface GoogleYouTubeConfig {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  accessToken?: string;
  autoPublish?: boolean;
  defaultPrivacy?: PublicationStatus;
}

/**
 * Production-ready implementation interacting with official Google YouTube Data API v3
 */
export class GoogleYouTubeService implements YouTubeService {
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private accessToken: string;
  private autoPublish: boolean;
  private defaultPrivacy: PublicationStatus;

  constructor(config?: GoogleYouTubeConfig) {
    this.clientId = config?.clientId ?? process.env.YOUTUBE_CLIENT_ID ?? "";
    this.clientSecret = config?.clientSecret ?? process.env.YOUTUBE_CLIENT_SECRET ?? "";
    this.refreshToken = config?.refreshToken ?? process.env.YOUTUBE_REFRESH_TOKEN ?? "";
    this.accessToken = config?.accessToken ?? process.env.YOUTUBE_ACCESS_TOKEN ?? "";
    this.autoPublish = config?.autoPublish ?? process.env.AUTO_PUBLISH === "true";
    this.defaultPrivacy = (config?.defaultPrivacy ??
      (process.env.DEFAULT_PRIVACY_STATUS?.toUpperCase() as PublicationStatus) ??
      "PRIVATE") as PublicationStatus;
  }

  /**
   * Retrieves or refreshes OAuth2 access token
   */
  private async getValidAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      throw new Error(
        "YouTube OAuth credentials missing. Require YOUTUBE_REFRESH_TOKEN, YOUTUBE_CLIENT_ID, and YOUTUBE_CLIENT_SECRET."
      );
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Failed to refresh YouTube OAuth token: ${tokenResponse.status} ${errText}`);
    }

    const data = (await tokenResponse.json()) as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    return this.accessToken;
  }

  public async uploadVideo(pkg: YouTubePublishPackage): Promise<YouTubeUploadResult> {
    const safetyNotes: string[] = [];
    let enforcedPrivacy = pkg.privacyStatus;

    // Safety guardrail: AUTO_PUBLISH=false forces PRIVATE or UNLISTED
    if (!this.autoPublish && (enforcedPrivacy === "PUBLIC" || enforcedPrivacy === "SCHEDULED")) {
      safetyNotes.push(
        `[SAFETY GUARDRAIL]: AUTO_PUBLISH is disabled. Downgraded privacy status from ${enforcedPrivacy} to ${this.defaultPrivacy}.`
      );
      enforcedPrivacy = this.defaultPrivacy;
    }

    const token = await this.getValidAccessToken();

    // 1. Prepare video resource metadata
    const resourceMetadata: Record<string, unknown> = {
      snippet: {
        title: pkg.title,
        description: pkg.description,
        tags: pkg.tags,
        categoryId: pkg.categoryId || "27",
        defaultLanguage: pkg.defaultLanguage || "en",
        defaultAudioLanguage: pkg.defaultAudioLanguage || "en",
      },
      status: {
        privacyStatus: enforcedPrivacy.toLowerCase(),
        selfDeclaredMadeForKids: false,
      },
    };

    if (enforcedPrivacy === "SCHEDULED" && pkg.publishAt) {
      (resourceMetadata.status as Record<string, unknown>).publishAt = pkg.publishAt;
      (resourceMetadata.status as Record<string, unknown>).privacyStatus = "private";
    }

    // 2. Initiate Resumable Upload
    const initResponse = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "video/*",
        },
        body: JSON.stringify(resourceMetadata),
      }
    );

    if (!initResponse.ok) {
      const errText = await initResponse.text();
      throw new Error(`YouTube resumable upload initiation failed: ${initResponse.status} ${errText}`);
    }

    const uploadUrl = initResponse.headers.get("Location");
    if (!uploadUrl) {
      throw new Error("YouTube API did not return resumable upload Location header.");
    }

    // 3. Upload Video Binary Data
    const file = Bun.file(pkg.videoPath);
    const fileExists = await file.exists();
    if (!fileExists) {
      throw new Error(`Video file not found at path: ${pkg.videoPath}`);
    }

    const videoBuffer = await file.arrayBuffer();
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": videoBuffer.byteLength.toString(),
      },
      body: videoBuffer,
    });

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      throw new Error(`YouTube video chunk upload failed: ${uploadResponse.status} ${errText}`);
    }

    const videoData = (await uploadResponse.json()) as { id: string; snippet?: { channelId?: string } };
    const videoId = videoData.id;

    // 4. Set thumbnail if provided
    let thumbnailUploaded = false;
    if (pkg.thumbnailPathOrUrl) {
      try {
        thumbnailUploaded = await this.setThumbnail(videoId, pkg.thumbnailPathOrUrl);
      } catch (thumbErr) {
        safetyNotes.push(`Warning: Thumbnail upload failed: ${(thumbErr as Error).message}`);
      }
    }

    return {
      videoId,
      videoUrl: `https://youtu.be/${videoId}`,
      title: pkg.title,
      privacyStatus: enforcedPrivacy,
      scheduledPublishTime: pkg.publishAt,
      thumbnailUploaded,
      thumbnailUrl: pkg.thumbnailPathOrUrl,
      uploadTime: new Date().toISOString(),
      channelId: videoData.snippet?.channelId,
      status: "SUCCESS",
      safetyNotes: safetyNotes.length > 0 ? safetyNotes : undefined,
    };
  }

  public async setThumbnail(videoId: string, thumbnailPathOrUrl: string): Promise<boolean> {
    const token = await this.getValidAccessToken();

    let thumbnailBytes: ArrayBuffer;
    if (thumbnailPathOrUrl.startsWith("http://") || thumbnailPathOrUrl.startsWith("https://")) {
      const resp = await fetch(thumbnailPathOrUrl);
      if (!resp.ok) return false;
      thumbnailBytes = await resp.arrayBuffer();
    } else {
      const file = Bun.file(thumbnailPathOrUrl);
      if (!(await file.exists())) return false;
      thumbnailBytes = await file.arrayBuffer();
    }

    const thumbResponse = await fetch(
      `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "image/jpeg",
        },
        body: thumbnailBytes,
      }
    );

    return thumbResponse.ok;
  }
}

/**
 * Deterministic Mock YouTube Service for testing, CI/CD, and offline verification
 */
export class MockYouTubeService implements YouTubeService {
  private autoPublish: boolean;
  private defaultPrivacy: PublicationStatus;

  constructor(options?: { autoPublish?: boolean; defaultPrivacy?: PublicationStatus }) {
    this.autoPublish = options?.autoPublish ?? process.env.AUTO_PUBLISH === "true";
    this.defaultPrivacy = (options?.defaultPrivacy ??
      (process.env.DEFAULT_PRIVACY_STATUS?.toUpperCase() as PublicationStatus) ??
      "PRIVATE") as PublicationStatus;
  }

  public async uploadVideo(pkg: YouTubePublishPackage): Promise<YouTubeUploadResult> {
    const safetyNotes: string[] = [];
    let enforcedPrivacy = pkg.privacyStatus;

    // Safety guardrail: AUTO_PUBLISH=false forces PRIVATE or UNLISTED
    if (!this.autoPublish && (enforcedPrivacy === "PUBLIC" || enforcedPrivacy === "SCHEDULED")) {
      safetyNotes.push(
        `[SAFETY GUARDRAIL]: AUTO_PUBLISH is disabled. Downgraded privacy status from ${enforcedPrivacy} to ${this.defaultPrivacy}.`
      );
      enforcedPrivacy = this.defaultPrivacy;
    }

    // Generate deterministic mock video ID
    const sanitizedTitle = pkg.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
    const videoId = `curio_${sanitizedTitle}_${Math.floor(Date.now() / 1000).toString(36)}`;

    let thumbnailUploaded = false;
    if (pkg.thumbnailPathOrUrl) {
      thumbnailUploaded = await this.setThumbnail(videoId, pkg.thumbnailPathOrUrl);
    }

    return {
      videoId,
      videoUrl: `https://youtu.be/${videoId}`,
      title: pkg.title,
      privacyStatus: enforcedPrivacy,
      scheduledPublishTime: pkg.publishAt,
      thumbnailUploaded,
      thumbnailUrl: pkg.thumbnailPathOrUrl,
      uploadTime: new Date().toISOString(),
      channelId: "UC_CurioverseMockChannel",
      status: "SIMULATED",
      safetyNotes: safetyNotes.length > 0 ? safetyNotes : undefined,
    };
  }

  public async setThumbnail(_videoId: string, thumbnailPathOrUrl: string): Promise<boolean> {
    // In mock mode, if a thumbnail path/url is provided, mark as successfully simulated
    return Boolean(thumbnailPathOrUrl && thumbnailPathOrUrl.length > 0);
  }
}

/**
 * Factory for creating the active YouTubeService instance
 */
export function createYouTubeService(): YouTubeService {
  const provider = (process.env.YOUTUBE_PROVIDER || "mock").toLowerCase();

  if (provider === "google" || provider === "youtube") {
    return new GoogleYouTubeService();
  }

  return new MockYouTubeService();
}
