/**
 * delete-document.ts
 * Used to delete a document.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiUrl } from "../../../lib/utils";

export async function deleteDocument(documentId: string): Promise<Response> {
    const response = await fetch(`${getApiUrl()}/documents/id/${documentId}?force=true`, {
        method: "DELETE",
            headers: {
              "Content-Type": "application/json",
        },
        credentials: "include",
    });
    return response;
}