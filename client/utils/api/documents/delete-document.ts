/**
 * delete-document.ts
 * Used to delete a document.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiBase } from "@/lib/api-base";
import { log } from "@/utils/logger";

export interface DeleteDocumentParams {
  documentId: string;
  force?: boolean;
}

export interface DeleteDocumentResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
}

export async function deleteDocument(
  documentId: string,
  force: boolean = true,
): Promise<DeleteDocumentResponse> {
  try {
    const url = new URL(`${getApiBase()}/documents/id/${documentId}`);
    if (force) {
      url.searchParams.set("force", "true");
    }

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        `Failed to delete document: ${response.status} ${response.statusText}`;
      log.error("documents.delete.failed", {
        message: errorMessage,
        context: { function: "deleteDocument", documentId },
      });
      return {
        success: false,
        message: errorMessage,
        status: "error",
      };
    }

    const result = await response.json();
    return {
      success: true,
      message: result.message || "Document deleted successfully",
      status: result.status || "success",
    };
  } catch (error) {
    const errorMessage = `Error deleting document ${documentId}: ${error instanceof Error ? error.message : "Unknown error"}`;
    log.error("documents.delete.error", {
      message: errorMessage,
      error,
      context: { function: "deleteDocument", documentId },
    });
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}
