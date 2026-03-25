/**
 * app/(main)/management/documents/new/page.tsx
 * New document page for the documents section.
 * @AshokSaravanan222
 * 01/12/2026
 */

import Document from "@/components/artifacts/document/Document";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetDocumentIn = InputOf<"/api/v5/artifacts/documents/get", "post">;
type GetDocumentOut = OutputOf<"/api/v5/artifacts/documents/get", "post">;
type CreateDocumentIn = InputOf<"/api/v5/artifacts/documents/create", "post">;
type CreateDocumentOut = OutputOf<"/api/v5/artifacts/documents/create", "post">;
type PatchDocumentDraftIn = InputOf<"/api/v5/artifacts/documents/draft", "patch">;
type PatchDocumentDraftOut = OutputOf<"/api/v5/artifacts/documents/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v5/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v5/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v5/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v5/resources/descriptions",
  "post"
>;
type CreateDraftUploadsIn = InputOf<"/api/v5/resources/uploads", "post">;
type CreateDraftUploadsOut = OutputOf<"/api/v5/resources/uploads", "post">;
type CreateDraftImagesIn = InputOf<"/api/v5/resources/images", "post">;
type CreateDraftImagesOut = OutputOf<"/api/v5/resources/images", "post">;
type CreateDraftTextsIn = InputOf<"/api/v5/resources/texts", "post">;
type CreateDraftTextsOut = OutputOf<"/api/v5/resources/texts", "post">;

/** Upload action result — matches the interface expected by resource components */
type UploadResult = { success: boolean; upload_id?: string; message?: string };

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

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createDocument(input: CreateDocumentIn): Promise<CreateDocumentOut> {
  "use server";
  return api.post("/artifacts/documents/create", input);
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

async function uploadFile(formData: FormData): Promise<UploadResult> {
  "use server";
  try {
    const file = formData.get("file") as File | null;
    if (!file) return { success: false, message: "No file provided" };

    const { getAuthHeaders } = await import("@/lib/api/auth-headers");
    const { INTERNAL_HTTP_BASE } = await import("@/lib/api/config");
    const authHeaders = await getAuthHeaders();

    const response = await fetch(`${INTERNAL_HTTP_BASE}/v5/documents/upload`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": file.type || "application/octet-stream",
        "X-Filename": file.name,
      },
      body: Buffer.from(await file.arrayBuffer()),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, message: text || "Upload failed" };
    }

    const result = await response.json();
    return { success: true, upload_id: result.upload_id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return { success: false, message };
  }
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v5/artifacts/documents/docs", "post">;
type DocsOut = OutputOf<"/api/v5/artifacts/documents/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/documents/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.new.title, description: docs.new.description };
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
  const [documentDetailDefault, draftsResult] = await Promise.all([
    getDocumentDefault(input),
    api.post("/artifacts/documents/drafts", {})
  ]);

  return (
    <DraftProviderClient drafts={draftsResult.entries ?? []}>
      <PageHeader
        breadcrumbs={[
          { title: "Management", section: "management", url: "/management" },
          { title: "Documents", section: "documents", url: "/management/documents" },
          { title: "New Document" },
        ]}
        toolbar={<SaveToolbar />}
      />
      <div
        className="space-y-6 px-4"
        data-page="document-new"
        aria-label="Create new document page"
      >
        <Document
          key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
          mode="create"
          documentDetailDefault={documentDetailDefault}
          createDocumentAction={createDocument}
          patchDocumentDraftAction={patchDocumentDraft}
          createNamesAction={createDraftNames}
          createDescriptionsAction={createDraftDescriptions}
          createUploadsAction={createDraftUploads}
          createImagesAction={createDraftImages}
          createTextsAction={createDraftTexts}
          uploadBasePath="/artifacts/documents"
          uploadFileAction={uploadFile}
        />
      </div>
    </DraftProviderClient>
  );
}

// Types are now defined inline in components using InputOf/OutputOf
