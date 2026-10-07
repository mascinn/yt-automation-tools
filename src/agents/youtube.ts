import { createYouTubeService } from "../services/youtube.ts";
import type {
  PublishContentRequest,
  YouTubePublishPackage,
  YouTubeService,
  YouTubeUploadResult,
} from "../types/content.ts";

/**
 * YouTube Agent
 * Responsible for validating human approval, packaging video assets and metadata,
 * enforcing publication safeguards, and orchestrating YouTube Data API distribution.
 */
export async function youtubeAgent(
  request: PublishContentRequest,
  service?: YouTubeService
): Promise<YouTubeUploadResult> {
  const ytService = service || createYouTubeService();

  // 1. Mandatory Human Review & Approval Verification
  const isApproved =
    request.humanApproved === true || (request.approval && request.approval.status === "APPROVED");

  if (!isApproved) {
    const currentStatus = request.approval?.status || "NOT_REVIEWED";
    throw new Error(
      `[PUBLICATION BLOCKED]: Human approval is required prior to YouTube distribution. Current approval status: "${currentStatus}". Set humanApproved: true or provide approval with status "APPROVED".`
    );
  }

  // 2. Extract and Validate Video Path
  const videoPath = request.videoPath || request.render?.outputVideoPath;
  if (!videoPath) {
    throw new Error(
      "[PUBLICATION BLOCKED]: Missing video file path. Provide 'videoPath' or a valid 'render' payload."
    );
  }

  // 3. Extract and Validate Metadata
  const title = request.title || request.metadata?.title;
  if (!title) {
    throw new Error(
      "[PUBLICATION BLOCKED]: Missing video title. Provide 'title' or a valid 'metadata' payload."
    );
  }

  const description = request.description || request.metadata?.description || "";
  const tags = request.tags || request.metadata?.tags || ["Curioverse", "Documentary", "Science", "Curiosity"];
  const categoryId = request.categoryId || request.metadata?.categoryId || "27"; // Category 27 = Education

  // 4. Resolve Thumbnail URL or Path
  const thumbnailPathOrUrl =
    request.thumbnailPathOrUrl || request.thumbnail?.selectedConcept?.imageUrl;

  // 5. Resolve Desired Privacy Status
  const privacyStatus = request.privacyStatus || "PRIVATE";

  // 6. Assemble Publication Package
  const publishPackage: YouTubePublishPackage = {
    videoPath,
    title,
    description,
    tags,
    categoryId,
    privacyStatus,
    publishAt: request.scheduledPublishTime,
    thumbnailPathOrUrl,
    defaultLanguage: "en",
    defaultAudioLanguage: "en",
  };

  // 7. Execute Upload through YouTube Service
  const result = await ytService.uploadVideo(publishPackage);

  console.log(
    `[YouTube Agent] Video "${title}" published successfully to YouTube. Video ID: ${result.videoId}, Privacy: ${result.privacyStatus}`
  );

  return result;
}
