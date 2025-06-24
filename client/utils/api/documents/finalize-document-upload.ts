/**
 * finalize-document-upload.ts
 * Used to finalize a document.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { logError } from "@/utils/logger";
import { getApiUrl } from "../../../lib/utils";

interface FinalizeDocumentUploadResponse {
  success: boolean;
  message: string;
}

export async function finalizeDocumentUpload(
  fileId: string,
  classId: string,
  zip?: boolean,
  autoClassify?: boolean
): Promise<FinalizeDocumentUploadResponse> {
  const payload = {
    fileId,
    classId,
    zip,
    autoClassify,
  };
  const response = await fetch(`${getApiUrl()}/documents/tus/finalize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorMessage = `Failed to finalize document upload: ${response.statusText}`;
    logError(errorMessage);
    throw new Error(errorMessage);
  }
  return response.json();
}
