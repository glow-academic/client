/**
 * app/(main)/management/documents/page.tsx
 * Documents list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
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

/** ---- Strong types from OpenAPI ---- */
type DocumentsListIn = InputOf<"/document/search", "post">;
type DocumentsListOut = OutputOf<"/document/search", "post">;
type DeleteDocumentIn = InputOf<"/document/delete", "post">;
type DeleteDocumentOut = OutputOf<"/document/delete", "post">;
type UpdateDocumentIn = InputOf<"/document/update", "post">;
type UpdateDocumentOut = OutputOf<"/document/update", "post">;
// GenerateTemplate types removed - now using WebSocket
type GenerateTemplateIn = never;
type GenerateTemplateOut = never;
type GroupDocumentIn = InputOf<"/document/group", "post">;
type GroupDocumentOut = OutputOf<"/document/group", "post">;
type GenerateDocumentIn = InputOf<"/document/generate", "post">;
type GenerateDocumentOut = OutputOf<"/document/generate", "post">;
type GenerationsIn = InputOf<"/document/generations", "post">;
type GenerationsOut = OutputOf<"/document/generations", "post">;
type ProblemDocumentIn = InputOf<"/document/problem", "post">;
type ProblemDocumentOut = OutputOf<"/document/problem", "post">;
type ContextIn = InputOf<"/document/context", "post">;
type ContextOut = OutputOf<"/document/context", "post">;

/** ---- Direct fetch (no Next.js cache) ---- */
const getDocumentsList = async (): Promise<DocumentsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/document/search",
    { body: {} },
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

async function generateDocument(
  input: GenerateDocumentIn
): Promise<GenerateDocumentOut> {
  "use server";
  return api.post("/document/generate", input);
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

async function runDocumentGenerate(input: GenerateDocumentIn): Promise<GenerateDocumentOut> {
  "use server";
  return api.post("/document/generate", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await api.post("/document/context", { body: {} } as ContextIn) as ContextOut;
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
    const context = await api.post("/document/context", { body: {} } as ContextIn) as ContextOut;
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/management/documents", context.profile.role_permissions);

    // Fetch list data, view cookie, and group in parallel
    const [listData, initialColumnVisibility, groupResult] = await Promise.all([
      getDocumentsList(),
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
        toolbar={<NewArtifactButton label="New Document" href="/management/documents/new" />}
        panelProps={{
          artifactType: "document",
          groupId: (groupResult as GroupDocumentOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as GroupDocumentOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          generateAction: generateDocument,
          operations: ["draft", "get", "group"],
          getGroupHistory: getDocumentGroupHistory,
          searchGroups: searchDocumentGroups,
          prompts: context.prompts?.prompts,
          getGroupAction: getDocumentGroup as PanelProps["getGroupAction"],
          searchGenerationsAction:
            searchDocumentGenerations as PanelProps["searchGenerationsAction"],
          runGenerateAction: runDocumentGenerate as PanelProps["runGenerateAction"],
        }}
      >
        <div className="space-y-6 px-4" data-page="documents-index">
          <Documents listData={listData} initialColumnVisibility={initialColumnVisibility} deleteDocumentAction={deleteDocument} updateDocumentAction={updateDocument} />
        </div>
      </FullPageLayout>
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
          reason="not-logged-in"
          pathname="/management/documents"
        />
      );
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
  GenerateTemplateIn,
  GenerateTemplateOut,
  UpdateDocumentIn,
  UpdateDocumentOut,
};
