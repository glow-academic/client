/**
 * app/(main)/create/documents/page.tsx
 * Documents list page - redirects to home with documents section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { createParameterItem } from "@/app/(main)/management/parameters/page";
import { getSession } from "@/auth";

import Documents from "@/components/documents/Documents";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag, unstable_cache } from "next/cache";

/** ---- Strong types from OpenAPI ---- */
type DocumentsListIn = InputOf<"/api/v3/documents/list", "post">;
type DocumentsListOut = OutputOf<"/api/v3/documents/list", "post">;
type DeleteDocumentIn = InputOf<"/api/v3/documents/delete", "post">;
type DeleteDocumentOut = OutputOf<"/api/v3/documents/delete", "post">;
type BulkDeleteDocumentsIn = InputOf<"/api/v3/documents/bulk-delete", "post">;
type BulkDeleteDocumentsOut = OutputOf<"/api/v3/documents/bulk-delete", "post">;
type UpdateDocumentIn = InputOf<"/api/v3/documents/update", "post">;
type UpdateDocumentOut = OutputOf<"/api/v3/documents/update", "post">;
type BulkUpdateDocumentsIn = InputOf<"/api/v3/documents/bulk-update", "post">;
type BulkUpdateDocumentsOut = OutputOf<"/api/v3/documents/bulk-update", "post">;
type FinalizeDocumentUploadIn = InputOf<
  "/api/v3/documents/upload/finalize",
  "post"
>;
type FinalizeDocumentUploadOut = OutputOf<
  "/api/v3/documents/upload/finalize",
  "post"
>;

/** ---- Cached fetch with Next tags ----
 * Cache key includes profileId so entries are per-user.
 * Tags allow revalidateTag("documents") to invalidate.
 */
const getDocumentsList = unstable_cache(
  async (profileId: string): Promise<DocumentsListOut> => {
    return api.post("/documents/list", { body: { profileId } });
  },
  ["documents:list"],
  { tags: ["documents"] }
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function deleteDocument(
  input: DeleteDocumentIn,
): Promise<DeleteDocumentOut> {
  "use server";
  const out = await api.post("/documents/delete", input);
  revalidateTag("documents");
  return out;
}

export async function bulkDeleteDocuments(
  input: BulkDeleteDocumentsIn,
): Promise<BulkDeleteDocumentsOut> {
  "use server";
  const out = await api.post("/documents/bulk-delete", input);
  revalidateTag("documents");
  return out;
}

export async function updateDocument(
  input: UpdateDocumentIn,
): Promise<UpdateDocumentOut> {
  "use server";
  const out = await api.post("/documents/update", input);
  revalidateTag("documents");
  return out;
}

export async function bulkUpdateDocuments(
  input: BulkUpdateDocumentsIn,
): Promise<BulkUpdateDocumentsOut> {
  "use server";
  const out = await api.post("/documents/bulk-update", input);
  revalidateTag("documents");
  return out;
}

export async function finalizeDocumentUpload(
  input: FinalizeDocumentUploadIn,
): Promise<FinalizeDocumentUploadOut> {
  "use server";
  const out = await api.post("/documents/upload/finalize", input);
  revalidateTag("documents");
  return out;
}

export const metadata: Metadata = {
  title: "Documents",
  description: `Documents in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function DocumentsPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getDocumentsList(profileId);

  return (
    <div className="space-y-6" data-page="documents-index">
      <Documents
        listData={listData}
        deleteDocumentAction={deleteDocument}
        bulkDeleteDocumentsAction={bulkDeleteDocuments}
        updateDocumentAction={updateDocument}
        bulkUpdateDocumentsAction={bulkUpdateDocuments}
        finalizeDocumentUploadAction={finalizeDocumentUpload}
        createParameterItemAction={createParameterItem}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  BulkDeleteDocumentsIn,
  BulkDeleteDocumentsOut,
  BulkUpdateDocumentsIn,
  BulkUpdateDocumentsOut,
  DeleteDocumentIn,
  DeleteDocumentOut,
  DocumentsListIn,
  DocumentsListOut,
  FinalizeDocumentUploadIn,
  FinalizeDocumentUploadOut,
  UpdateDocumentIn,
  UpdateDocumentOut,
};
