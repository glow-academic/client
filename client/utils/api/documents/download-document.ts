/**
 * download-document.ts
 * Used to download a document.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiUrl } from "../../../lib/utils";

export async function downloadDocument(documentId: string): Promise<Response> {
  const response = await fetch(`${getApiUrl()}/documents/id/${documentId}`, {
    method: "GET",
  });
  return response;
}
