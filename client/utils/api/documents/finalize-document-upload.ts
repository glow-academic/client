/**
 * finalize-document-upload.ts
 * Used to finalize a document.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiBase } from "@/lib/api-base";
import { log } from "@/utils/logger";

export interface FinalizeDocumentUploadParams {
  fileId: string;
  zip?: boolean;
  autoClassify?: boolean;
  csv?: boolean;
  profileId?: string;
}

export interface ExtractedDocument {
  id: string;
  name: string;
  mime_type: string;
}

export interface ClassificationResult {
  success: boolean;
  message: string;
  classified_count?: number;
  total_count?: number;
  classification_results?: Record<string, unknown>;
}

export interface CourseResult {
  success: boolean;
  message: string;
  updates_made?: string[];
  documents_count?: number;
  course_info?: Record<string, unknown>;
  debug_info?: string;
}

export interface FinalizeDocumentUploadResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
  document_id?: string;
  extracted_count?: number;
  documents?: ExtractedDocument[];
  classification_result?: ClassificationResult;
  course_result?: CourseResult;
  users_created?: number;
  users_skipped?: number;
  errors?: string[];
  created_users?: unknown[];
  skipped_users?: unknown[];
}

export async function finalizeDocumentUpload(
  fileId: string,
  zip?: boolean,
  autoClassify?: boolean,
  profileId?: string,
  csv?: boolean,
  test?: boolean,
): Promise<FinalizeDocumentUploadResponse> {
  try {
    const payload: FinalizeDocumentUploadParams = {
      fileId,
      ...(zip !== undefined && { zip }),
      ...(autoClassify !== undefined && { autoClassify }),
      ...(csv !== undefined && { csv }),
      ...(profileId !== undefined && { profileId }),
      ...(test !== undefined && { test }),
    };

    const apiBase = getApiBase();
    const finalizeUrl = `${apiBase}/documents/tus/finalize`;

    log.info("documents.finalize.start", {
      message: "Starting document finalization",
      context: {
        function: "finalizeDocumentUpload",
        fileId,
        apiBase,
        finalizeUrl,
        payload,
      },
    });

    const response = await fetch(finalizeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    log.info("documents.finalize.response", {
      message: `Finalization response: ${response.status} ${response.statusText}`,
      context: {
        function: "finalizeDocumentUpload",
        fileId,
        responseStatus: response.status,
        responseStatusText: response.statusText,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        `Failed to finalize document upload: ${response.status} ${response.statusText}`;
      log.error("documents.finalize.failed", {
        message: errorMessage,
        context: { function: "finalizeDocumentUpload", fileId },
      });
      return {
        success: false,
        message: errorMessage,
        status: "error",
      };
    }

    const result = await response.json();

    log.info("documents.finalize.success", {
      message: "Document finalization successful",
      context: {
        function: "finalizeDocumentUpload",
        fileId,
        result,
      },
    });
    return {
      success: true,
      message: result.message || "Document upload finalized successfully",
      status: result.status || "success",
      document_id: result.document_id,
      extracted_count: result.extracted_count,
      documents: result.documents,
      classification_result: result.classification_result,
      course_result: result.course_result,
      users_created: result.users_created,
      users_skipped: result.users_skipped,
      errors: result.errors,
      created_users: result.created_users,
      skipped_users: result.skipped_users,
    };
  } catch (error) {
    const errorMessage = `Error finalizing document upload: ${error instanceof Error ? error.message : "Unknown error"}`;
    log.error("documents.finalize.error", {
      message: errorMessage,
      error,
      context: { function: "finalizeDocumentUpload", fileId },
    });
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}
