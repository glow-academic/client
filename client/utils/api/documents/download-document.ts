/**
 * download-document.ts
 * Used to download a document.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { logError } from "@/utils/logger";

export interface DownloadDocumentParams {
  documentId: string;
}

export interface DownloadDocumentResponse {
  success: boolean;
  message: string;
  data?: Response;
  headers?: Headers;
  text?: () => Promise<string>;
  blob?: () => Promise<Blob>;
}

export async function downloadDocument(
  documentId: string
): Promise<DownloadDocumentResponse> {
  try {
    // Use the Next.js API route instead of calling FastAPI directly
    const response = await fetch(`/api/download/document/${documentId}`, {
      method: "GET",
      credentials: "include", // Include cookies for authentication
    });

    if (!response.ok) {
      // Try to get error details from JSON response
      let errorMessage = `Failed to download document ${documentId}: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // If not JSON, use the default error message
      }

      logError(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }

    // Return the response with helper methods for the client
    return {
      success: true,
      message: "Document downloaded successfully",
      data: response,
      headers: response.headers,
      text: () => response.text(),
      blob: () => response.blob(),
    };
  } catch (error) {
    const errorMessage = `Error downloading document ${documentId}: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError(errorMessage, error);
    return {
      success: false,
      message: errorMessage,
    };
  }
}
