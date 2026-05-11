/**
 * app/(main)/management/documents/page.tsx
 * Documents list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import Documents from "@/components/artifacts/document/Documents";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { readViewCookie } from "@/lib/view-cookie";
import { loadDocumentsSearchParams } from "@/lib/search-params/documents";
import type { ParseCsvResult } from "@/components/common/BulkImport";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type DocumentsListIn = InputOf<"/document/search", "post">;
type DocumentsListOut = OutputOf<"/document/search", "post">;
type DeleteDocumentIn = InputOf<"/document/delete", "post">;
type DeleteDocumentOut = OutputOf<"/document/delete", "post">;
type UpdateDocumentIn = InputOf<"/document/update", "post">;
type UpdateDocumentOut = OutputOf<"/document/update", "post">;
type CreateDocumentIn = InputOf<"/document/create", "post">;
type CreateDocumentOut = OutputOf<"/document/create", "post">;
// GenerateTemplate types removed - now using WebSocket
type GenerateTemplateIn = never;
type GenerateTemplateOut = never;
type GroupDocumentIn = InputOf<"/document/group", "post">;
type GroupDocumentOut = OutputOf<"/document/group", "post">;
type GenerationsIn = InputOf<"/document/generations", "post">;
type GenerationsOut = OutputOf<"/document/generations", "post">;
type ProblemDocumentIn = InputOf<"/document/problem", "post">;
type ProblemDocumentOut = OutputOf<"/document/problem", "post">;
type ContextIn = InputOf<"/document/context", "post">;
type ContextOut = OutputOf<"/document/context", "post">;

/** ---- Body type for documents list request ----
 *  Matches the server's ``SearchDocumentApiRequest`` validator. The
 *  client passes this same shape to the bulk delete/update endpoints
 *  under ``all=true`` mode so the server can resolve matching ids
 *  without a client-side enumeration round-trip. Derived from the
 *  OpenAPI input so ``page_size`` / ``page_offset`` nullability stays
 *  in sync with the server. */
type DocumentsListBody = NonNullable<DocumentsListIn["body"]>;

/** ---- Direct fetch (no Next.js cache) ---- */
const getDocumentsList = async (body: DocumentsListBody): Promise<DocumentsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/document/search",
    { body },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    },
  );
};

/** ---- Strongly-typed server actions ---- */
async function deleteDocument(
  input: DeleteDocumentIn,
): Promise<DeleteDocumentOut> {
  "use server";
  return api.post("/document/delete", input);
}

async function updateDocument(
  input: UpdateDocumentIn,
): Promise<UpdateDocumentOut> {
  "use server";
  return api.post("/document/update", input);
}

async function createDocument(input: CreateDocumentIn): Promise<CreateDocumentOut> {
  "use server";
  return api.post("/document/create", input);
}

async function exportDocuments(): Promise<{
  file_id: string;
  file_name?: string;
}> {
  "use server";
  const result = (await api.post("/document/export", {
    body: {},
  } as unknown as InputOf<"/document/export", "post">)) as unknown as {
    file_id: string;
    file_name?: string;
  };
  return {
    file_id: result.file_id,
    ...(result.file_name !== undefined && { file_name: result.file_name }),
  };
}

async function refreshDocuments(): Promise<unknown> {
  "use server";
  return api.post("/document/refresh", {
    body: {},
  } as unknown as InputOf<"/document/refresh", "post">);
}

async function parseCsv(formData: FormData): Promise<ParseCsvResult> {
  "use server";
  return api.post("/document/csv", { formData });
}


async function getDocumentGroupHistory(groupId: string): Promise<GroupDocumentOut> {
  "use server";
  return api.post("/document/group", { body: { group_id: groupId } } as GroupDocumentIn);
}

async function searchDocumentGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/document/generations", { body: { search: query || null } } as GenerationsIn);
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


/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getDocumentContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/document/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getDocumentContext();
    return {
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Documents" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface DocumentsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const session = await getSession();
  const q = loadDocumentsSearchParams(await searchParams);

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  try {
    // Profile data for providers
    const context = await getDocumentContext();
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/management/documents", context.profile.role_permissions);

    // The documents list page doesn't yet expose URL-backed filters,
    // but we still build a ``body`` so bulk write endpoints under
    // ``selectAll=1`` mode have a well-formed filter envelope to echo
    // back. As filter URL state is added, populate fields from ``q``
    // here — the client component already passes this through.
    // ``page_size``/``page_offset`` are required-but-nullable in the
    // OpenAPI schema; passing null lets the server use its defaults.
    const body: DocumentsListBody = {
      page_size: null,
      page_offset: null,
    };

    // Fetch list data, view cookie, and group in parallel
    const [listData, initialColumnVisibility, groupResult] = await Promise.all([
      getDocumentsList(body),
      readViewCookie("documents"),
      api.post(
        "/document/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupDocumentIn,
      ),
    ]);

    return (
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
          { title: "Documents" },
        ]}
        toolbar={
          <ArtifactToolbarActions
            newButton={{ label: "New Document", href: "/management/documents/new" }}
            exportAction={exportDocuments}
            refreshAction={refreshDocuments}
            bffDownloadPrefix="/api/document/download"
          />
        }
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
          getGroupHistory: getDocumentGroupHistory,
          searchGroups: searchDocumentGroups,
          prompts: context.prompts?.prompts,
          getGroupAction: getDocumentGroup as PanelProps["getGroupAction"],
          searchGenerationsAction:
            searchDocumentGenerations as PanelProps["searchGenerationsAction"],
        }}
      >
        <div className="space-y-6 px-4" data-page="documents-index">
          <Documents
            listData={listData}
            initialColumnVisibility={initialColumnVisibility}
            deleteDocumentAction={deleteDocument}
            updateDocumentAction={updateDocument}
            createDocumentAction={createDocument}
            parseCsvAction={parseCsv}
            importFields={listData.import_fields ?? undefined}
            currentSearchBody={body}
          />
        </div>
      </FullPageLayout>
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error
    ) {
      // 401 → not logged in. 403 → resource belongs to a department the
      // user isn't in. Don't conflate.
      if (error.status === 401) {
        return (
          <UnifiedAccessDenied
            reason="not-logged-in"
            pathname="/management/documents"
          />
        );
      }
      if (error.status === 403) {
        return (
          <UnifiedAccessDenied
            reason="department"
            resourceType="document"
            redirectPath="/management/documents"
          />
        );
      }
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteDocumentIn,
  DeleteDocumentOut,
  DocumentsListIn,
  DocumentsListOut,
  DocumentsListBody,
  GenerateTemplateIn,
  GenerateTemplateOut,
  UpdateDocumentIn,
  UpdateDocumentOut,
  CreateDocumentIn,
  CreateDocumentOut,
};
