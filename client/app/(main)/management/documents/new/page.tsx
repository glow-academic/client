/**
 * app/(main)/management/documents/new/page.tsx
 * New document page for document upload
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */

import { getSession } from "@/auth";

import DocumentNew from "@/components/documents/DocumentNew";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type DocumentsListIn = InputOf<"/api/v3/documents/list", "post">;
type DocumentsListOut = OutputOf<"/api/v3/documents/list", "post">;
type FinalizeUploadIn = InputOf<
  "/api/v3/uploads/upload/{upload_id}/finalize",
  "post"
>;
type FinalizeUploadOut = OutputOf<
  "/api/v3/uploads/upload/{upload_id}/finalize",
  "post"
>;
type CreateDocumentIn = InputOf<"/api/v3/documents/create", "post">;
type CreateDocumentOut = OutputOf<"/api/v3/documents/create", "post">;

/** ---- Direct fetch (no Next.js cache) ---- */
const getDocumentsList = async (
  profileId: string
): Promise<DocumentsListOut> => {
  return api.post(
    "/documents/list",
    { body: { profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function finalizeUpload(
  uploadId: string,
): Promise<FinalizeUploadOut> {
  "use server";
  return api.post(`/uploads/upload/${uploadId}/finalize`, {});
}

async function createDocument(
  input: CreateDocumentIn,
): Promise<CreateDocumentOut> {
  "use server";
  return api.post("/documents/create", input);
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
    title: "New Document",
    description: `Upload new documents in GLOW${orgPart}.`,
  };
}

export default async function NewDocumentPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side for mappings
  const listData = await getDocumentsList(profileId);

  return (
    <div
      className="space-y-6"
      data-page="document-new"
      aria-label="Create new document page"
    >
      <DocumentNew
        listData={listData}
        finalizeUploadAction={finalizeUpload}
        createDocumentAction={createDocument}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DocumentsListIn,
  DocumentsListOut,
  FinalizeUploadIn,
  FinalizeUploadOut,
  CreateDocumentIn,
  CreateDocumentOut,
};

