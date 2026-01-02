/**
 * app/(main)/management/documents/new/page.tsx
 * New document page for document upload
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */

import Document from "@/components/documents/Document";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type DocumentsListIn = InputOf<"/api/v4/documents/list", "post">;
type DocumentsListOut = OutputOf<"/api/v4/documents/list", "post">;
type FinalizeUploadIn = InputOf<
  "/api/v4/uploads/upload/{upload_id}/finalize",
  "post"
>;
type FinalizeUploadOut = OutputOf<
  "/api/v4/uploads/upload/{upload_id}/finalize",
  "post"
>;
type CreateDocumentIn = InputOf<"/api/v4/documents/create", "post">;
type CreateDocumentOut = OutputOf<"/api/v4/documents/create", "post">;
type PatchDocumentDraftIn = InputOf<"/api/v4/documents/draft", "patch">;
type PatchDocumentDraftOut = OutputOf<"/api/v4/documents/draft", "patch">;
// GenerateTemplate types removed - now using WebSocket
type GenerateTemplateIn = never;
type GenerateTemplateOut = never;
// RenderTemplate types removed - not used on new page since we don't have documentId yet

/** ---- Direct fetch (no Next.js cache) ---- */
const getDocumentsList = async (): Promise<DocumentsListOut> => {
  return api.post(
    "/documents/list",
    { body: {} },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function finalizeUpload(uploadId: string): Promise<FinalizeUploadOut> {
  "use server";
  return api.post("/uploads/upload/{upload_id}/finalize", {
    path: { upload_id: uploadId },
    body: {},
  } as FinalizeUploadIn);
}

async function createDocument(
  input: CreateDocumentIn,
): Promise<CreateDocumentOut> {
  "use server";
  return api.post("/documents/create", input);
}

async function patchDocumentDraft(
  input: PatchDocumentDraftIn
): Promise<PatchDocumentDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/documents/draft", input);
}

// generateTemplate removed - component now uses WebSocket directly

// renderTemplate removed - not used on new page since we don't have documentId yet

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Document",
    description:
      "Upload new learning resources and educational documents for teaching assistant training. Add course materials, instructional resources, and reference documents to support pedagogical development and L&D program content.",
  };
}

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Parse search params using nuqs
  const params = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Inline server-side parsers for document search params (draftId only)
  const documentSearchParams = {
    draftId: parseAsString,
  };
  const loadDocumentSearchParams = createLoader(documentSearchParams);
  const q = loadDocumentSearchParams(searchParamsObj);

  // Fetch list data server-side for mappings
  // Note: Documents don't have a separate "new" endpoint - list endpoint provides mappings
  const listData = await getDocumentsList();

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
      <Document
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        mode="create"
        documentDetailDefault={listData}
        finalizeUploadAction={finalizeUpload}
        createDocumentAction={createDocument}
        patchDocumentDraftAction={patchDocumentDraft}
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
  PatchDocumentDraftIn,
  PatchDocumentDraftOut,
};
