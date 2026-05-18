/**
 * app/(main)/management/fields/page.tsx
 * Fields list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
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
import type { ParseCsvResult } from "@/components/common/BulkImport";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type FieldsListOut = OutputOf<"/field/search", "post">;
type DuplicateFieldIn = InputOf<"/field/duplicate", "post">;
type DuplicateFieldOut = OutputOf<"/field/duplicate", "post">;
type DeleteFieldIn = InputOf<"/field/delete", "post">;
type DeleteFieldOut = OutputOf<"/field/delete", "post">;
type UpdateFieldIn = InputOf<"/field/update", "post">;
type UpdateFieldOut = OutputOf<"/field/update", "post">;
type CreateFieldIn = InputOf<"/field/create", "post">;
type CreateFieldOut = OutputOf<"/field/create", "post">;
type GroupFieldIn = InputOf<"/field/group", "post">;
type GroupFieldOut = OutputOf<"/field/group", "post">;
type GenerationsIn = InputOf<"/field/generations", "post">;
type GenerationsOut = OutputOf<"/field/generations", "post">;
type ProblemFieldIn = InputOf<"/field/problem", "post">;
type ProblemFieldOut = OutputOf<"/field/problem", "post">;
type ContextIn = InputOf<"/field/context", "post">;
type ContextOut = OutputOf<"/field/context", "post">;

/** ---- Body type for fields list request ----
 *  Mirrors ``SearchFieldApiRequest`` so the all-matching bulk write
 *  path can spread this verbatim into ``/field/delete`` /
 *  ``/field/update`` bodies under ``selectAll=1`` mode.
 *
 *  ``page_size`` / ``page_offset`` are list-pagination knobs that
 *  ``SearchFieldApiRequest`` requires; the bulk delete/update
 *  validators ignore unknown fields, so spreading this whole body
 *  through is safe. */
type FieldsListBody = {
  search?: string | null;
  parameter_ids?: string[] | null;
  persona_ids?: string[] | null;
  filter_department_ids?: string[] | null;
  parameter_search?: string | null;
  persona_search?: string | null;
  department_search?: string | null;
  flag_search?: string | null;
  page_size: number | null;
  page_offset: number | null;
};

/** ---- Direct fetch (no Next.js cache) ---- */
const getFieldsList = async (body: FieldsListBody): Promise<FieldsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/field/search",
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

async function createField(input: CreateFieldIn): Promise<CreateFieldOut> {
  "use server";
  return api.post("/field/create", input);
}

async function exportFields(): Promise<{
  file_id: string;
  file_name?: string;
}> {
  "use server";
  const result = (await api.post("/field/export", {
    body: {},
  } as unknown as InputOf<"/field/export", "post">)) as unknown as {
    file_id: string;
    file_name?: string;
  };
  return {
    file_id: result.file_id,
    ...(result.file_name !== undefined && { file_name: result.file_name }),
  };
}

async function refreshFields(): Promise<unknown> {
  "use server";
  return api.post("/field/refresh", {
    body: {},
  } as unknown as InputOf<"/field/refresh", "post">);
}

async function parseCsv(formData: FormData): Promise<ParseCsvResult> {
  "use server";
  return api.post("/field/csv", { formData });
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


/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getFieldContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/field/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getFieldContext();
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
    const context = await getFieldContext();
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/management/fields", context.profile.role_permissions);

    // The fields list page uses client-side faceted filters (TanStack
    // table column filters) rather than threading filter state through
    // the URL → server. Until we move filters server-side the SSR body
    // is empty, but it's still threaded as ``currentSearchBody`` so the
    // bulk all-matching shape can spread it verbatim once that lands.
    const body: FieldsListBody = {
      page_size: null,
      page_offset: null,
    };

    // Fetch list data, view cookie, and group in parallel
    const [listData, initialColumnVisibility, groupResult] = await Promise.all([
      getFieldsList(body),
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
        toolbar={
          <ArtifactToolbarActions
            newButton={{ label: "New Field", href: "/management/fields/new" }}
            exportAction={exportFields}
            refreshAction={refreshFields}
            bffDownloadPrefix="/api/field/download"
          />
        }
        panelProps={{
          artifactType: "field",
          initialPanelPrefs: await readGenerationPanelPrefs(),
          groupId: (groupResult as GroupFieldOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as GroupFieldOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          operations: ["draft", "get", "title"],
          getGroupHistory: getFieldGroupHistory,
          searchGroups: searchFieldGroups,
          prompts: context.prompts?.prompts,
          getGroupAction: getFieldGroup as PanelProps["getGroupAction"],
          searchGenerationsAction:
            searchFieldGenerations as PanelProps["searchGenerationsAction"],
        }}
      >
        <div className="space-y-6 px-4" data-page="fields-index">
          <Fields
            listData={listData}
            initialColumnVisibility={initialColumnVisibility}
            duplicateFieldAction={duplicateField}
            deleteFieldAction={deleteField}
            updateFieldAction={updateField}
            createFieldAction={createField}
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
            pathname="/management/fields"
          />
        );
      }
      if (error.status === 403) {
        return (
          <UnifiedAccessDenied
            reason="department"
            resourceType="field"
            redirectPath="/management/fields"
          />
        );
      }
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  FieldsListOut,
  FieldsListBody,
  DeleteFieldIn,
  DeleteFieldOut,
  DuplicateFieldIn,
  DuplicateFieldOut,
  UpdateFieldIn,
  UpdateFieldOut,
  CreateFieldIn,
  CreateFieldOut,
};
