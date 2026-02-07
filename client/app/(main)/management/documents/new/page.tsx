/**
 * app/(main)/management/documents/new/page.tsx
 * New document page for the documents section.
 * @AshokSaravanan222
 * 01/12/2026
 */

import Document from "@/components/documents/Document";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetDocumentIn = InputOf<"/api/v4/documents/get", "post">;
type GetDocumentOut = OutputOf<"/api/v4/documents/get", "post">;
type SaveDocumentIn = InputOf<"/api/v4/documents/save", "post">;
type SaveDocumentOut = OutputOf<"/api/v4/documents/save", "post">;
type PatchDocumentDraftIn = InputOf<"/api/v4/documents/draft", "patch">;
type PatchDocumentDraftOut = OutputOf<"/api/v4/documents/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftUploadsIn = InputOf<"/api/v4/resources/uploads", "post">;
type CreateDraftUploadsOut = OutputOf<"/api/v4/resources/uploads", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getDocumentDefault = async (
  input: GetDocumentIn
): Promise<GetDocumentOut> => {
  return api.post("/documents/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function saveDocument(input: SaveDocumentIn): Promise<SaveDocumentOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/documents/save", input);
}

async function patchDocumentDraft(
  input: PatchDocumentDraftIn
): Promise<PatchDocumentDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/documents/draft", input);
}

async function createDraftNames(
  input: CreateDraftNamesIn
): Promise<CreateDraftNamesOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/names", input);
}

async function createDraftDescriptions(
  input: CreateDraftDescriptionsIn
): Promise<CreateDraftDescriptionsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/descriptions", input);
}

async function createDraftUploads(
  input: CreateDraftUploadsIn
): Promise<CreateDraftUploadsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/uploads", input);
}

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

  // Inline server-side parsers for document search params (navigation/search params only)
  const documentSearchParams = {
    draftId: parseAsString,
    // Search/filter params
    descriptionSearch: parseAsString,
    fieldSearch: parseAsString,
    fieldShowSelected: parseAsBoolean,
  };
  const loadDocumentSearchParams = createLoader(documentSearchParams);
  const q = loadDocumentSearchParams(searchParamsObj);

  // Fetch default document detail server-side with filter params and draft_id
  const input: GetDocumentIn = {
    body: {
      document_id: null, // NULL for new mode
      draft_id: q.draftId ?? null,
    } as GetDocumentIn["body"],
  };
  const documentDetailDefault = await getDocumentDefault(input);

  return (
    <div
      className="space-y-6"
      data-page="document-new"
      aria-label="Create new document page"
    >
      <Document
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        mode="create"
        documentDetailDefault={documentDetailDefault}
        saveDocumentAction={saveDocument}
        patchDocumentDraftAction={patchDocumentDraft}
        createNamesAction={createDraftNames}
        createDescriptionsAction={createDraftDescriptions}
        createUploadsAction={createDraftUploads}
      />
    </div>
  );
}

// Types are now defined inline in components using InputOf/OutputOf
