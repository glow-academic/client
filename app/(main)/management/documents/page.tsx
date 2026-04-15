/**
 * app/(main)/management/documents/page.tsx
 * Documents list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Documents from "@/components/artifacts/document/Documents";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { getLayoutContextData } from "@/app/(main)/layout-server";

/** ---- Strong types from OpenAPI ---- */
type DocumentsListIn = InputOf<"/documents/search", "post">;
type DocumentsListOut = OutputOf<"/documents/search", "post">;
type DeleteDocumentIn = InputOf<"/documents/delete", "post">;
type DeleteDocumentOut = OutputOf<"/documents/delete", "post">;
// GenerateTemplate types removed - now using WebSocket
type GenerateTemplateIn = never;
type GenerateTemplateOut = never;
type GroupDocumentIn = InputOf<"/documents/group", "post">;
type GroupDocumentOut = OutputOf<"/documents/group", "post">;
type GenerateDocumentIn = InputOf<"/documents/generate", "post">;
type GenerateDocumentOut = OutputOf<"/documents/generate", "post">;
type GenerationsIn = InputOf<"/documents/generations", "post">;
type GenerationsOut = OutputOf<"/documents/generations", "post">;
type ProblemDocumentIn = InputOf<"/documents/problem", "post">;
type ProblemDocumentOut = OutputOf<"/documents/problem", "post">;
type ContextIn = InputOf<"/documents/context", "post">;
type ContextOut = OutputOf<"/documents/context", "post">;

/** ---- Direct fetch (no Next.js cache) ---- */
const getDocumentsList = async (): Promise<DocumentsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/documents/search",
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
  return api.post("/documents/delete", input);
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
    title: context.page_metadata?.list.title,
    description: context.page_metadata?.list.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function DocumentsPage() {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const { profileData, snapshot } = await getLayoutContextData(session);

  // Fetch list data and group in parallel
  const [listData, groupResult] = await Promise.all([
    getDocumentsList(),
    api.post("/documents/group", { body: {} } as GroupDocumentIn),
  ]);

  return (
    <FullPageLayout
      profileData={profileData}
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
      <div className="space-y-6 px-4" data-page="documents-index">
        <Documents listData={listData} deleteDocumentAction={deleteDocument} />
      </div>
    </FullPageLayout>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteDocumentIn,
  DeleteDocumentOut,
  DocumentsListIn,
  DocumentsListOut,
  GenerateTemplateIn,
  GenerateTemplateOut,
};
