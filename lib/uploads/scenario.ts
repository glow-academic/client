/**
 * Scenario artifact upload helpers.
 *
 * Each function POSTs a single File to its artifact-scoped BFF route
 * (`app/api/scenario/{image,video}_upload/route.ts`) and returns the
 * upstream payload. Modeled on ``hooks/use-attempt-transcribe.ts``: the
 * caller hands us a File, we hand back the resource ids — no URL
 * knowledge leaks to the component.
 *
 * Errors throw — call site decides how to surface (toast, etc.).
 */

import { uploadMultipart } from "./shared";

export interface ScenarioImageUploadResult {
  image_id: string;
  upload_id: string;
}

export async function uploadScenarioImage(
  file: File,
): Promise<ScenarioImageUploadResult> {
  return uploadMultipart<ScenarioImageUploadResult>(
    "/api/scenario/image_upload",
    file,
    "image_id",
  );
}

export interface ScenarioVideoUploadResult {
  video_id: string;
  upload_id: string;
}

export async function uploadScenarioVideo(
  file: File,
): Promise<ScenarioVideoUploadResult> {
  return uploadMultipart<ScenarioVideoUploadResult>(
    "/api/scenario/video_upload",
    file,
    "video_id",
  );
}
