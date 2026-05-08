/**
 * app/(main)/management/documents/[documentId]/page.tsx
 * Document edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Document from "@/components/artifacts/document/Document";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  createLoader,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
} from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";
import type { DraftItem } from "@/contexts/draft-context";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type GetDocumentIn = InputOf<"/document/get", "post">;
type GetDocumentOut = OutputOf<"/document/get", "post">;
export type DocumentDetailOut = GetDocumentOut;
type CreateDocumentIn = InputOf<"/document/create", "post">;
type CreateDocumentOut = OutputOf<"/document/create", "post">;
type UpdateDocumentIn = InputOf<"/document/update", "post">;
type UpdateDocumentOut = OutputOf<"/document/update", "post">;
type PatchDocumentDraftIn = InputOf<"/document/draft", "patch">;
type PatchDocumentDraftOut = OutputOf<"/document/draft", "patch">;
type GroupDocumentIn = InputOf<"/document/group", "post">;
type GroupDocumentOut = OutputOf<"/document/group", "post">;
type GenerationsIn = InputOf<"/document/generations", "post">;
type GenerationsOut = OutputOf<"/document/generations", "post">;
type ProblemDocumentIn = InputOf<"/document/problem", "post">;
type ProblemDocumentOut = OutputOf<"/document/problem", "post">;
type ContextIn = InputOf<"/document/context", "post">;
type ContextOut = OutputOf<"/document/context", "post">;
type DocumentDraftsIn = InputOf<"/document/drafts", "post">;
type DocumentDraftsOut = OutputOf<"/document/drafts", "post">;
type DocumentSectionFilter = Exclude<
  NonNullable<NonNullable<GetDocumentIn["body"]>["descriptions"]>,
  null | undefined
>;

/** Upload action result — matches the interface expected by resource components */
type UploadResult = { success: boolean; file_id?: string; message?: string };

/** ---- Direct fetch (no caching - source of truth) ---- */
const getDocumentDefault = async (
  input: GetDocumentIn
): Promise<GetDocumentOut> => {
  return api.post("/document/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions ---- */
async function createDocument(input: CreateDocumentIn): Promise<CreateDocumentOut> {
  "use server";
  return api.post("/document/create", input);
}

async function updateDocument(input: UpdateDocumentIn): Promise<UpdateDocumentOut> {
  "use server";
  return api.post("/document/update", input);
}

async function patchDocumentDraft(
  input: PatchDocumentDraftIn
): Promise<PatchDocumentDraftOut> {
  "use server";
  return api.patch("/document/draft", input);
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
    return { success: true, file_id: result.file_id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return { success: false, message };
  }
}

async function createDocumentProblem(input: ProblemDocumentIn): Promise<ProblemDocumentOut> {
  "use server";
  return api.post("/document/problem", input);
}

/** ---- GenerationPanel server actions ---- */
async function getDocumentGroup(input: GroupDocumentIn): Promise<GroupDocumentOut> {
  "use server";
  return api.post("/document/group", input);
}

async function searchDocumentGenerations(input: GenerationsIn): Promise<GenerationsOut> {
  "use server";
  return api.post("/document/generations", input);
}


const buildSectionFilter = (
  opts: {
    search?: string | null;
    selected?: boolean | null;
    parameter_ids?: string[] | null;
  },
) => {
  const filter: DocumentSectionFilter = {};
  if (opts.search != null) filter["search"] = opts.search;
  if (opts.selected != null) filter["selected"] = opts.selected;
  if (opts.parameter_ids != null && opts.parameter_ids.length > 0) {
    filter["parameter_ids"] = opts.parameter_ids;
  }
  return Object.keys(filter).length > 0 ? filter : undefined;
};

/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getDocumentContextById = cache(
  async (id: string): Promise<ContextOut> =>
    api.post("/document/context", { body: { entity_id: id } } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ documentId: string }>;
}): Promise<Metadata> {
  try {
    const { documentId } = await params;
    const context = await getDocumentContextById(documentId);
    return {
      title: context.page_metadata?.detail.title,
      description: context.page_metadata?.detail.description,
    };
  } catch {
    return { title: "Documents" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

/** ---- Server renders client with typed data and actions ---- */
export default async function DocumentEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { documentId } = await params;
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

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

  const documentSearchParams = {
    draftId: parseAsString,
    descriptionSearch: parseAsString,
    fieldSearch: parseAsString,
    uploadSearch: parseAsString,
    fieldShowSelected: parseAsBoolean,
    parameterIds: parseAsArrayOf(parseAsString),
    groupId: parseAsString,
    groupSearch: parseAsString,
  };
  const loadDocumentSearchParams = createLoader(documentSearchParams);
  const q = loadDocumentSearchParams(searchParamsObj);

  try {
    const descriptionsFilter = buildSectionFilter({ search: q.descriptionSearch });
    const parameterFieldsFilter = buildSectionFilter({
      search: q.fieldSearch,
      selected: q.fieldShowSelected,
      parameter_ids: q.parameterIds,
    });
    const filesFilter = buildSectionFilter({ search: q.uploadSearch });

    const body = {
      id: documentId,
      draft_id: q.draftId ?? null,
      ...(descriptionsFilter ? { descriptions: descriptionsFilter } : {}),
      ...(parameterFieldsFilter
        ? { parameter_fields: parameterFieldsFilter }
        : {}),
      ...(filesFilter ? { files: filesFilter } : {}),
    } satisfies NonNullable<GetDocumentIn["body"]>;

    const [documentDetail, context, draftsResult, groupResult] = await Promise.all([
      getDocumentDefault({ body } as GetDocumentIn),
      getDocumentContextById(documentId) as Promise<ContextOut>,
      api.post("/document/drafts", {} as DocumentDraftsIn),
      api.post(
        "/document/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupDocumentIn,
      ),
    ]);
    const snapshot = buildSnapshot(session, context.profile);

    const entityName = context.page_metadata?.detail.title;

    return (
      <DraftProviderClient
        drafts={((draftsResult as DocumentDraftsOut).entries ?? []) as unknown as DraftItem[]}
      >
        <FullPageLayout
          profileData={context.profile}
          sessionSnapshot={snapshot}
          {...(initialSidebarOpen !== undefined ? { initialSidebarOpen } : {})}
          initialPanelOpen={initialPanelOpen}
          sidebarProps={{
            activeSection: "document",
            createFeedback:
              createDocumentProblem as unknown as (
                input: Record<string, unknown>,
              ) => Promise<Record<string, unknown>>,
          }}
          breadcrumbs={[
            { title: "Management", section: "management", url: "/management" },
            { title: "Documents", section: "documents", url: "/management/documents" },
            { title: entityName ?? "Document" },
          ]}
          toolbar={<SaveToolbar />}
          panelProps={{
            artifactType: "document",
          initialPanelPrefs: await readGenerationPanelPrefs(),
            groupId: (groupResult as GroupDocumentOut & { group_id?: string })?.group_id ?? null,
            groupName:
              (groupResult as GroupDocumentOut & { name?: string | null })?.name ?? null,
            // Forward the full SSR-fetched group payload — the panel
            // seeds historicalMessages from this synchronously and
            // skips the duplicate client-side /<art>/group refetch
            // on first paint, eliminating the hydration flicker.
            initialGroupHistory: groupResult as Record<string, unknown>,
            operations: ["draft", "get", "title"],
            ...(context.prompts?.prompts ? { prompts: context.prompts.prompts } : {}),
            getGroupAction: getDocumentGroup as PanelProps["getGroupAction"],
            searchGenerationsAction:
              searchDocumentGenerations as PanelProps["searchGenerationsAction"],
          }}
        >
          <div
            className="space-y-6 px-4"
            data-page="document-edit"
            data-document-id={documentId}
          >
            <Document
              key={q.draftId || "no-draft"}
              documentId={documentId}
              mode="edit"
              documentDetail={documentDetail}
              createDocumentAction={createDocument}
              updateDocumentAction={updateDocument}
              patchDocumentDraftAction={patchDocumentDraft}
              uploadBasePath="/document"
              uploadFileAction={uploadFile}
            />
          </div>
        </FullPageLayout>
      </DraftProviderClient>
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error.status === 401 || error.status === 403)
    ) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="document"
          redirectPath="/management/documents"
        />
      );
    }
    throw error;
  }
}
