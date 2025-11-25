/**
 * app/(main)/management/documents/page.tsx
 * Documents list page - redirects to home with documents section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { createParameterItem } from "@/app/(main)/management/parameters/page";
import { getSession } from "@/auth";

import Documents from "@/components/documents/Documents";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

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

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getDocumentsList = async (
  profileId: string
): Promise<DocumentsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/documents/list",
    { body: { profileId } },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    }
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function deleteDocument(
  input: DeleteDocumentIn,
): Promise<DeleteDocumentOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/documents/delete", input);
}

async function bulkDeleteDocuments(
  input: BulkDeleteDocumentsIn,
): Promise<BulkDeleteDocumentsOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/documents/bulk-delete", input);
}

async function updateDocument(
  input: UpdateDocumentIn,
): Promise<UpdateDocumentOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/documents/update", input);
}

async function bulkUpdateDocuments(
  input: BulkUpdateDocumentsIn,
): Promise<BulkUpdateDocumentsOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/documents/bulk-update", input);
}

async function finalizeDocumentUpload(
  input: FinalizeDocumentUploadIn,
): Promise<FinalizeDocumentUploadOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/documents/upload/finalize", input);
}

export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";

  let organizationName = "";
  let organizationDescription = "";
  try {
    const activeSettings = await api.post("/settings/active", {
      body: { profileId },
    });
    organizationName = activeSettings.organization_name || "";
    organizationDescription = activeSettings.organization_description || "";
  } catch {
    // If settings unavailable, organizationName and organizationDescription will be empty
  }

  const orgPart = organizationName
    ? ` at ${organizationName}${organizationDescription ? ` - ${organizationDescription}` : ""}`
    : "";

  return {
    title: "Documents",
    description: `Documents in GLOW${orgPart}.`,
  };
}

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
