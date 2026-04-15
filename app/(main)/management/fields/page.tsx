/**
 * app/(main)/management/fields/page.tsx
 * Fields list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Fields from "@/components/artifacts/field/Fields";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { getLayoutContextData } from "@/app/(main)/layout-server";

/** ---- Strong types from OpenAPI ---- */
type FieldsListOut = OutputOf<"/fields/search", "post">;
type DuplicateFieldIn = InputOf<"/fields/duplicate", "post">;
type DuplicateFieldOut = OutputOf<"/fields/duplicate", "post">;
type DeleteFieldIn = InputOf<"/fields/delete", "post">;
type DeleteFieldOut = OutputOf<"/fields/delete", "post">;
type GroupFieldIn = InputOf<"/fields/group", "post">;
type GroupFieldOut = OutputOf<"/fields/group", "post">;
type GenerateFieldIn = InputOf<"/fields/generate", "post">;
type GenerateFieldOut = OutputOf<"/fields/generate", "post">;
type GenerationsIn = InputOf<"/fields/generations", "post">;
type GenerationsOut = OutputOf<"/fields/generations", "post">;
type ProblemFieldIn = InputOf<"/fields/problem", "post">;
type ProblemFieldOut = OutputOf<"/fields/problem", "post">;
type ContextIn = InputOf<"/fields/context", "post">;
type ContextOut = OutputOf<"/fields/context", "post">;

/** ---- Direct fetch (no Next.js cache) ---- */
const getFieldsList = async (): Promise<FieldsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/fields/search",
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

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function duplicateField(
  input: DuplicateFieldIn,
): Promise<DuplicateFieldOut> {
  "use server";
  return api.post("/fields/duplicate", input);
}

async function deleteField(input: DeleteFieldIn): Promise<DeleteFieldOut> {
  "use server";
  return api.post("/fields/delete", input);
}

async function generateField(
  input: GenerateFieldIn
): Promise<GenerateFieldOut> {
  "use server";
  return api.post("/fields/generate", input);
}

async function getFieldGroupHistory(groupId: string): Promise<GroupFieldOut> {
  "use server";
  return api.post("/fields/group", { body: { group_id: groupId } } as GroupFieldIn);
}

async function searchFieldGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/fields/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createFieldProblem(input: ProblemFieldIn): Promise<ProblemFieldOut> {
  "use server";
  return api.post("/fields/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/fields/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.list.title,
    description: context.page_metadata?.list.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function FieldsPage() {
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
    getFieldsList(),
    api.post("/fields/group", { body: {} } as GroupFieldIn),
  ]);

  return (
    <FullPageLayout
      profileData={profileData}
      sessionSnapshot={snapshot}
      initialSidebarOpen={initialSidebarOpen}
      initialPanelOpen={initialPanelOpen}
      sidebarProps={{
        activeSection: "field",
        createFeedback: createFieldProblem,
      }}
      breadcrumbs={[
        { title: "Management", section: "management", url: "/management" },
        { title: "Fields" },
      ]}
      toolbar={<NewArtifactButton label="New Field" href="/management/fields/new" />}
      panelProps={{
        artifactType: "field",
        groupId: (groupResult as GroupFieldOut & { group_id?: string })?.group_id ?? null,
        generateAction: generateField,
        permissions: [
          { artifact: "field", operation: "draft" },
          { artifact: "field", operation: "get" },
          { artifact: "field", operation: "docs" },
          { artifact: "field", operation: "group" },
        ],
        getGroupHistory: getFieldGroupHistory,
        searchGroups: searchFieldGroups,
      }}
    >
      <div className="space-y-6 px-4" data-page="fields-index">
        <Fields
          listData={listData}
          duplicateFieldAction={duplicateField}
          deleteFieldAction={deleteField}
        />
      </div>
    </FullPageLayout>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  FieldsListOut,
  DeleteFieldIn,
  DeleteFieldOut,
  DuplicateFieldIn,
  DuplicateFieldOut,
};
