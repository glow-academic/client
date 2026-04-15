/**
 * app/(main)/management/documents/new/page.tsx
 * New document page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222
 * 01/12/2026
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Document from "@/components/artifacts/document/Document";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type GetDocumentIn = InputOf<"/documents/get", "post">;
type GetDocumentOut = OutputOf<"/documents/get", "post">;
type CreateDocumentIn = InputOf<"/documents/create", "post">;
type CreateDocumentOut = OutputOf<"/documents/create", "post">;
type PatchDocumentDraftIn = InputOf<"/documents/draft", "patch">;
type PatchDocumentDraftOut = OutputOf<"/documents/draft", "patch">;
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
type GroupDocumentIn = InputOf<"/documents/group", "post">;
type GroupDocumentOut = OutputOf<"/documents/group", "post">;
type GenerateDocumentIn = InputOf<"/documents/generate", "post">;
type GenerateDocumentOut = OutputOf<"/documents/generate", "post">;
type ProblemDocumentIn = InputOf<"/documents/problem", "post">;
type ProblemDocumentOut = OutputOf<"/documents/problem", "post">;
type ContextIn = InputOf<"/documents/context", "post">;
type ContextOut = OutputOf<"/documents/context", "post">;

/** Upload action result — matches the interface expected by resource components */
type UploadResult = { success: boolean; upload_id?: string; message?: string };

/** ---- Direct fetch (no caching - source of truth) ---- */
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

/** ---- Strongly-typed server actions ---- */
async function createDocument(input: CreateDocumentIn): Promise<CreateDocumentOut> {
  "use server";
  return api.post("/documents/create", input);
}

async function patchDocumentDraft(
  input: PatchDocumentDraftIn
): Promise<PatchDocumentDraftOut> {
  "use server";
  return api.patch("/documents/draft", input);
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

async function generateDocument(
  input: GenerateDocumentIn
): Promise<GenerateDocumentOut> {
  "use server";
  return api.post("/documents/generate", input);
}

async function getDocumentGroupHistory(groupId: string): Promise<GroupDocumentOut> {
  "use server";
  return api.post("/documents/group", { body: { group_id: groupId } } as GroupDocumentIn);
}

type GenerationsIn = InputOf<"/documents/generations", "post">;
type GenerationsOut = OutputOf<"/documents/generations", "post">;

async function searchDocumentGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/documents/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createDocumentProblem(input: ProblemDocumentIn): Promise<ProblemDocumentOut> {
  "use server";
  return api.post("/documents/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/documents/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.new.title,
    description: context.page_metadata?.new.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/documents/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

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

  const documentSearchParams = {
    draftId: parseAsString,
    descriptionSearch: parseAsString,
    fieldSearch: parseAsString,
    fieldShowSelected: parseAsBoolean,
  };
  const loadDocumentSearchParams = createLoader(documentSearchParams);
  const q = loadDocumentSearchParams(searchParamsObj);

  const input: GetDocumentIn = {
    body: {
      document_id: null,
      draft_id: q.draftId ?? null,
    } as GetDocumentIn["body"],
  };

  const [documentDetailDefault, draftsResult, groupResult] = await Promise.all([
    getDocumentDefault(input),
    api.post("/documents/drafts", {}),
    api.post("/documents/group", { body: {} } as GroupDocumentIn),
  ]);

  return (
    <DraftProviderClient drafts={draftsResult.entries ?? []}>
      <FullPageLayout
        profileData={context.profile}
        sessionSnapshot={snapshot}
        initialSidebarOpen={initialSidebarOpen}
        initialPanelOpen={initialPanelOpen}
        sidebarProps={{
          activeSection: "document",
          createFeedback: createDocumentProblem,
        }}
        breadcrumbs={[
          { title: "Management", section: "management", url: "/management" },
          { title: "Documents", section: "documents", url: "/management/documents" },
          { title: "New Document" },
        ]}
        toolbar={<SaveToolbar />}
        panelProps={{
          artifactType: "document",
          groupId: (groupResult as GroupDocumentOut & { group_id?: string })?.group_id ?? null,
          generateAction: generateDocument,
          permissions: [
            { artifact: "document", operation: "draft" },
            { artifact: "document", operation: "get" },
            { artifact: "document", operation: "docs" },
            { artifact: "document", operation: "group" },
          ],
          getGroupHistory: getDocumentGroupHistory,
          searchGroups: searchDocumentGroups,
        }}
      >
        <div
          className="space-y-6 px-4"
          data-page="document-new"
          aria-label="Create new document page"
        >
          <Document
            key={q.draftId || "no-draft"}
            mode="create"
            documentDetailDefault={documentDetailDefault}
            createDocumentAction={createDocument}
            patchDocumentDraftAction={patchDocumentDraft}
            createNamesAction={createDraftNames}
            createDescriptionsAction={createDraftDescriptions}
            createUploadsAction={createDraftUploads}
            createImagesAction={createDraftImages}
            createTextsAction={createDraftTexts}
            uploadBasePath="/documents"
            uploadFileAction={uploadFile}
          />
        </div>
      </FullPageLayout>
    </DraftProviderClient>
  );
}
