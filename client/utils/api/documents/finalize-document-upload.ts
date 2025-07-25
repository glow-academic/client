/**
 * finalize-document-upload.ts
 * Used to finalize a document.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiBase } from "@/lib/api-base";
import { logError } from "@/utils/logger";

export interface FinalizeDocumentUploadParams {
  fileId: string;
  zip?: boolean;
  autoClassify?: boolean;
  csv?: boolean;
  profile?: string;
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
  csv?: boolean,
  profile?: string,
  test?: boolean
): Promise<FinalizeDocumentUploadResponse> {
  try {
    const payload: FinalizeDocumentUploadParams = {
      fileId,
      ...(zip !== undefined && { zip }),
      ...(autoClassify !== undefined && { autoClassify }),
      ...(csv !== undefined && { csv }),
      ...(profile !== undefined && { profile }),
      ...(test !== undefined && { test }),
    };

    const response = await fetch(`${getApiBase()}/documents/tus/finalize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        `Failed to finalize document upload: ${response.status} ${response.statusText}`;
      logError(errorMessage);
      return {
        success: false,
        message: errorMessage,
        status: "error",
      };
    }

    const result = await response.json();
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
    logError(errorMessage, error);
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}
