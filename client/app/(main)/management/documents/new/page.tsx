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
type GenerateTemplateIn = InputOf<
  "/api/v3/documents/generate-template",
  "post"
>;
type GenerateTemplateOut = OutputOf<
  "/api/v3/documents/generate-template",
  "post"
>;
// RenderTemplate types removed - not used on new page since we don't have documentId yet

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
async function finalizeUpload(uploadId: string): Promise<FinalizeUploadOut> {
  "use server";
  return api.post(`/uploads/upload/${uploadId}/finalize`, {});
}

async function createDocument(
  input: CreateDocumentIn
): Promise<CreateDocumentOut> {
  "use server";
  return api.post("/documents/create", input);
}

async function generateTemplate(
  input: GenerateTemplateIn
): Promise<GenerateTemplateOut> {
  "use server";
  return api.post("/documents/generate-template", input);
}

// renderTemplate removed - not used on new page since we don't have documentId yet

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

  // Note: Server-side rendering on new page is not implemented since we don't have a documentId yet
  // The form will handle rendering client-side until document is created
  // Once document is created, user can navigate to detail page for server-side rendering
  const renderedHtml: string | null = null;

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
        generateTemplateAction={generateTemplate}
        renderedHtml={renderedHtml}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateDocumentIn,
  CreateDocumentOut,
  DocumentsListIn,
  DocumentsListOut,
  FinalizeUploadIn,
  FinalizeUploadOut,
  GenerateTemplateIn,
  GenerateTemplateOut,
};
