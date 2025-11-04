/**
 * Server-side fetcher functions for documents v2 API
 * These are used for server-side prefetching in Next.js pages and BFF routes
 * Memoized with React cache to prevent duplicate requests
 */

import { getApiBase } from "@/lib/api/v2/api-base";
import { cache } from "react";
import { DocumentDetailResponseSchema } from "../schemas/documents";

/**
 * Fetch document detail from FastAPI server (memoized)
 * Used in both BFF routes and server components
 */
export const fetchDocumentDetail = cache(
  async (documentId: string, profileId: string) => {
    const res = await fetch(`${getApiBase()}/api/v2/documents/detail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ documentId, profileId }),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch document detail");
    }

    const data = await res.json();
    return DocumentDetailResponseSchema.parse(data);
  }
);

/**
 * Fetch bulk document details from FastAPI server (memoized)
 * Used in both BFF routes and server components
 */
export const fetchDocumentDetailBulk = cache(
  async (documentIds: string[], profileId: string) => {
    const res = await fetch(`${getApiBase()}/api/v2/documents/detail-bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ documentIds, profileId }),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch bulk document details");
    }

    const data = await res.json();
    // Note: Bulk endpoints typically return arrays, adjust schema if needed
    return data;
  }
);
