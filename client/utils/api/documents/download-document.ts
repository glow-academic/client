/**
 * download-document.ts
 * Used to download a document.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { logError } from "@/utils/logger";
import { getApiUrl } from "../../../lib/utils";

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
    const response = await fetch(`${getApiUrl()}/documents/id/${documentId}`, {
      method: "GET",
    });

    if (!response.ok) {
      const errorMessage = `Failed to download document ${documentId}: ${response.status} ${response.statusText}`;
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
