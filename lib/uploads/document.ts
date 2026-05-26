/**
 * Document artifact upload helpers.
 *
 * Each function POSTs a single File to its artifact-scoped BFF route
 * (`app/api/document/{file,image}_upload/route.ts`) and returns the
 * upstream payload. Mirrors ``lib/uploads/scenario.ts`` — see that file
 * for the canonical shape and rationale.
 */

import { uploadMultipart } from "./shared";

export interface DocumentFileUploadResult {
  file_id: string;
  upload_id?: string;
}

export async function uploadDocumentFile(
  file: File,
): Promise<DocumentFileUploadResult> {
  return uploadMultipart<DocumentFileUploadResult>(
    "/api/document/file_upload",
    file,
    "file_id",
  );
}

export interface DocumentImageUploadResult {
  image_id: string;
  upload_id: string;
}

export async function uploadDocumentImage(
  file: File,
): Promise<DocumentImageUploadResult> {
  return uploadMultipart<DocumentImageUploadResult>(
    "/api/document/image_upload",
    file,
    "image_id",
  );
}
