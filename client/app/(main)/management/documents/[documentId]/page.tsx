/**
 * app/(main)/management/documents/[documentId]/page.tsx
 * Document edit page
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Document from "@/components/artifacts/document/Document";
import { resolveGroupId } from "@/app/(main)/layout-server";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetDocumentIn = InputOf<"/api/v4/artifacts/documents/get", "post">;
type GetDocumentOut = OutputOf<"/api/v4/artifacts/documents/get", "post">;
export type DocumentDetailOut = GetDocumentOut;
type SaveDocumentIn = InputOf<"/api/v4/artifacts/documents/save", "post">;
type SaveDocumentOut = OutputOf<"/api/v4/artifacts/documents/save", "post">;
type PatchDocumentDraftIn = InputOf<"/api/v4/artifacts/documents/draft", "patch">;
type PatchDocumentDraftOut = OutputOf<"/api/v4/artifacts/documents/draft", "patch">;
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
type CreateDraftImagesIn = InputOf<"/api/v4/resources/images", "post">;
type CreateDraftImagesOut = OutputOf<"/api/v4/resources/images", "post">;
type CreateDraftTextsIn = InputOf<"/api/v4/resources/texts", "post">;
type CreateDraftTextsOut = OutputOf<"/api/v4/resources/texts", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getDocumentDefault = async (
  input: GetDocumentIn
): Promise<GetDocumentOut> => {
  return api.post("/artifacts/documents/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/documents/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/documents/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/documents/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ documentId: string }>;
}): Promise<Metadata> {
  const { documentId } = await params;
  const docs = await getDocs({ body: { entity_id: documentId } });
  return { title: docs.detail.title, description: docs.detail.description };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function saveDocument(input: SaveDocumentIn): Promise<SaveDocumentOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/documents/save", input);
}

async function patchDocumentDraft(
  input: PatchDocumentDraftIn
): Promise<PatchDocumentDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/artifacts/documents/draft", input);
}

async function createDraftNames(
  input: CreateDraftNamesIn
): Promise<CreateDraftNamesOut> {
  "use server";
  return api.post("/resources/names", input);
}

async function createDraftDescriptions(
  input: CreateDraftDescriptionsIn
): Promise<CreateDraftDescriptionsOut> {
  "use server";
  return api.post("/resources/descriptions", input);
}

async function createDraftUploads(
  input: CreateDraftUploadsIn
): Promise<CreateDraftUploadsOut> {
  "use server";
  return api.post("/resources/uploads", input);
}

async function createDraftImages(
  input: CreateDraftImagesIn
): Promise<CreateDraftImagesOut> {
  "use server";
  return api.post("/resources/images", input);
}

async function createDraftTexts(
  input: CreateDraftTextsIn
): Promise<CreateDraftTextsOut> {
  "use server";
  return api.post("/resources/texts", input);
}

const getDocument = async (
  documentId: string,
  draftId: string | null,
  groupId?: string,
): Promise<GetDocumentOut> => {
  return getDocumentDefault({
    body: { document_id: documentId, draft_id: draftId, group_id: groupId ?? null },
  });
};

/** ---- Server renders client with typed data and actions ---- */
export default async function DocumentEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { documentId } = await params;
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Parse search params using nuqs
  const paramsObj = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(paramsObj).forEach(([key, value]) => {
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

  // Resolve group_id from layout context (cached per request)
  const groupId = await resolveGroupId(q.draftId ?? null, "document");

  // Fetch document detail (always fresh - source of truth) with draft_id
  try {
    const documentDetail = await getDocument(documentId, q.draftId ?? null, groupId);

    return (
      <div
        className="space-y-6"
        data-page="document-edit"
        data-document-id={documentId}
      >
        <Document
          key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
          documentId={documentId}
          mode="edit"
          documentDetail={documentDetail}
          saveDocumentAction={saveDocument}
          patchDocumentDraftAction={patchDocumentDraft}
          createNamesAction={createDraftNames}
          createDescriptionsAction={createDraftDescriptions}
          createUploadsAction={createDraftUploads}
          createImagesAction={createDraftImages}
          createTextsAction={createDraftTexts}
        />
      </div>
    );
  } catch (error: unknown) {
    // Check if it's a 403 error (department access denied)
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 403
    ) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="document"
          redirectPath="/management/documents"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

// Types are now defined inline in components using InputOf/OutputOf
