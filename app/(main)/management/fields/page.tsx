/**
 * app/(main)/management/fields/page.tsx
 * Fields list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Fields from "@/components/artifacts/field/Fields";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { readViewCookie } from "@/lib/view-cookie";
import { loadFieldsSearchParams } from "@/lib/search-params/fields";

/** ---- Strong types from OpenAPI ---- */
type FieldsListOut = OutputOf<"/field/search", "post">;
type DuplicateFieldIn = InputOf<"/field/duplicate", "post">;
type DuplicateFieldOut = OutputOf<"/field/duplicate", "post">;
type DeleteFieldIn = InputOf<"/field/delete", "post">;
type DeleteFieldOut = OutputOf<"/field/delete", "post">;
type UpdateFieldIn = InputOf<"/field/update", "post">;
type UpdateFieldOut = OutputOf<"/field/update", "post">;
type GroupFieldIn = InputOf<"/field/group", "post">;
type GroupFieldOut = OutputOf<"/field/group", "post">;
type GenerateFieldIn = InputOf<"/field/generate", "post">;
type GenerateFieldOut = OutputOf<"/field/generate", "post">;
type GenerationsIn = InputOf<"/field/generations", "post">;
type GenerationsOut = OutputOf<"/field/generations", "post">;
type ProblemFieldIn = InputOf<"/field/problem", "post">;
type ProblemFieldOut = OutputOf<"/field/problem", "post">;
type ContextIn = InputOf<"/field/context", "post">;
type ContextOut = OutputOf<"/field/context", "post">;

/** ---- Direct fetch (no Next.js cache) ---- */
const getFieldsList = async (): Promise<FieldsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/field/search",
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
  return api.post("/field/duplicate", input);
}

async function deleteField(input: DeleteFieldIn): Promise<DeleteFieldOut> {
  "use server";
  return api.post("/field/delete", input);
}

async function updateField(input: UpdateFieldIn): Promise<UpdateFieldOut> {
  "use server";
  return api.post("/field/update", input);
}

async function generateField(
  input: GenerateFieldIn
): Promise<GenerateFieldOut> {
  "use server";
  return api.post("/field/generate", input);
}

async function getFieldGroupHistory(groupId: string): Promise<GroupFieldOut> {
  "use server";
  return api.post("/field/group", { body: { group_id: groupId } } as GroupFieldIn);
}

async function searchFieldGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/field/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createFieldProblem(input: ProblemFieldIn): Promise<ProblemFieldOut> {
  "use server";
  return api.post("/field/problem", input);
}

/** ---- GenerationPanel server actions ---- */
async function getFieldGroup(input: GroupFieldIn): Promise<GroupFieldOut> {
  "use server";
  return api.post("/field/group", input);
}

async function searchFieldGenerations(input: GenerationsIn): Promise<GenerationsOut> {
  "use server";
  return api.post("/field/generations", input);
}

async function runFieldGenerate(input: GenerateFieldIn): Promise<GenerateFieldOut> {
  "use server";
  return api.post("/field/generate", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await api.post("/field/context", { body: {} } as ContextIn) as ContextOut;
    return {
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Fields" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface FieldsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function FieldsPage({ searchParams }: FieldsPageProps) {
  const session = await getSession();
  const q = loadFieldsSearchParams(await searchParams);

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  try {
    // Profile data for providers
    const context = await api.post("/field/context", { body: {} } as ContextIn) as ContextOut;
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/management/fields", context.profile.role_permissions);

    // Fetch list data, view cookie, and group in parallel
    const [listData, initialColumnVisibility, groupResult] = await Promise.all([
      getFieldsList(),
      readViewCookie("fields"),
      api.post(
        "/field/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupFieldIn,
      ),
    ]);

    return (
      <FullPageLayout
        profileData={context.profile}
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
          groupName:
            (groupResult as GroupFieldOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          generateAction: generateField,
          operations: ["draft", "get", "group"],
          getGroupHistory: getFieldGroupHistory,
          searchGroups: searchFieldGroups,
          prompts: context.prompts?.prompts,
          getGroupAction: getFieldGroup as PanelProps["getGroupAction"],
          searchGenerationsAction:
            searchFieldGenerations as PanelProps["searchGenerationsAction"],
          runGenerateAction: runFieldGenerate as PanelProps["runGenerateAction"],
        }}
      >
        <div className="space-y-6 px-4" data-page="fields-index">
          <Fields
            listData={listData}
            initialColumnVisibility={initialColumnVisibility}
            duplicateFieldAction={duplicateField}
            deleteFieldAction={deleteField}
            updateFieldAction={updateField}
          />
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
          pathname="/management/fields"
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  FieldsListOut,
  DeleteFieldIn,
  DeleteFieldOut,
  DuplicateFieldIn,
  DuplicateFieldOut,
  UpdateFieldIn,
  UpdateFieldOut,
};
