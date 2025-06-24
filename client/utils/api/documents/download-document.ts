/**
 * download-document.ts
 * Used to download a document.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { logError } from "@/utils/logger";
import { getApiUrl } from "../../../lib/utils";

export interface DownloadDocumentResponse {
  success: boolean;
  message: string;
}

export async function downloadDocument(documentId: string): Promise<DownloadDocumentResponse> {
  const response = await fetch(`${getApiUrl()}/documents/id/${documentId}`, {
    method: "GET",
  });
  if (!response.ok) {
    const errorMessage = `Failed to download document ${documentId}: ${response.statusText}`;
    logError(errorMessage);
    throw new Error(errorMessage);
  }
  return response.json();
}
