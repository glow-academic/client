/**
 * app/(main)/management/fields/new/page.tsx
 * New field page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Field from "@/components/artifacts/field/Field";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type GetFieldIn = InputOf<"/field/get", "post">;
type GetFieldOut = OutputOf<"/field/get", "post">;
type CreateFieldIn = InputOf<"/field/create", "post">;
type CreateFieldOut = OutputOf<"/field/create", "post">;
type PatchFieldDraftIn = InputOf<"/field/draft", "patch">;
type PatchFieldDraftOut = OutputOf<"/field/draft", "patch">;
type GroupFieldIn = InputOf<"/field/group", "post">;
type GroupFieldOut = OutputOf<"/field/group", "post">;
type ProblemFieldIn = InputOf<"/field/problem", "post">;
type ProblemFieldOut = OutputOf<"/field/problem", "post">;
type ContextIn = InputOf<"/field/context", "post">;
type ContextOut = OutputOf<"/field/context", "post">;

/** ---- Direct fetch for default field data with timeout ---- */
const getFieldDefault = async (input: GetFieldIn): Promise<GetFieldOut> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const result = await api.post("/field/get", input, {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timeout - please try again");
    }
    throw error;
  }
};

/** ---- Strongly-typed server actions ---- */
async function createField(input: CreateFieldIn): Promise<CreateFieldOut> {
  "use server";
  return api.post("/field/create", input);
}

async function patchFieldDraft(
  input: PatchFieldDraftIn,
): Promise<PatchFieldDraftOut> {
  "use server";
  return api.patch("/field/draft", input);
}


async function getFieldGroupHistory(groupId: string): Promise<GroupFieldOut> {
  "use server";
  return api.post("/field/group", { body: { group_id: groupId } } as GroupFieldIn);
}

type GenerationsIn = InputOf<"/field/generations", "post">;
type GenerationsOut = OutputOf<"/field/generations", "post">;

async function searchFieldGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/field/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createFieldProblem(input: ProblemFieldIn): Promise<ProblemFieldOut> {
  "use server";
  return api.post("/field/problem", input);
}

/** Export-all — used by the /new page's Download button to fetch
 *  the current full dataset as a CSV template. No per-item id
 *  since the user hasn't created the new artifact yet. Cast through
 *  ``unknown`` while openapi.json catches up to the file-modality
 *  response shape. */
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
      title: context.page_metadata?.new.title,
      description: context.page_metadata?.new.description,
    };
  } catch {
    return { title: "Fields" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

/** ---- Server renders client with typed data and actions ---- */
export default async function NewFieldPage({
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

  try {
    // Profile data for providers
    const context = await getFieldContext();
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

    // Inline server-side parsers for field search params
    const fieldSearchParams = {
      draftId: parseAsString,
      descriptionSearch: parseAsString,
      conditionalParameterSearch: parseAsString,
      conditionalParameterShowSelected: parseAsBoolean,
    };
    const loadFieldSearchParams = createLoader(fieldSearchParams);
    const q = loadFieldSearchParams(searchParamsObj);

    // Fetch default field data with draft_id (field_id = null for new mode)
    const body = {
      id: null,
      draft_id: q.draftId ?? null,
      ...(q.descriptionSearch
        ? {
            descriptions: {
              search: q.descriptionSearch,
            },
          }
        : {}),
      ...(q.conditionalParameterSearch ||
      q.conditionalParameterShowSelected !== null
        ? {
            conditional_parameters: {
              ...(q.conditionalParameterSearch
                ? { search: q.conditionalParameterSearch }
                : {}),
              ...(q.conditionalParameterShowSelected !== null
                ? { selected: q.conditionalParameterShowSelected }
                : {}),
            },
          }
        : {}),
    };
    const input = {
      path: undefined,
      body,
    } as GetFieldIn;
    const [fieldData, draftsResult, groupResult] = await Promise.all([
      getFieldDefault(input),
      api.post("/field/drafts", { body: {} } as any),
      api.post("/field/group", { body: {} } as GroupFieldIn),
    ]);

    return (
      <DraftProviderClient drafts={(draftsResult.entries ?? []) as any}>
        <FullPageLayout
          {...({
            profileData: context.profile,
            sessionSnapshot: snapshot,
            initialSidebarOpen,
            initialPanelOpen,
            sidebarProps: {
              activeSection: "field",
              createFeedback: createFieldProblem as any,
            },
            breadcrumbs: [
              { title: "Management", section: "management", url: "/management" },
              { title: "Fields", section: "fields", url: "/management/fields" },
              { title: "New Field" },
            ],
            toolbar: (
              <ArtifactToolbarActions
                leftSlot={<SaveToolbar />}
                exportAction={exportFields}
                refreshAction={refreshFields}
                bffDownloadPrefix="/api/field/download"
              />
            ),
            panelProps: {
              artifactType: "field",
              initialPanelPrefs: await readGenerationPanelPrefs(),
              groupId:
                (groupResult as GroupFieldOut & { group_id?: string })?.group_id ??
                null,
              operations: ["draft", "get", "title"],
              getGroupHistory: getFieldGroupHistory,
              searchGroups: searchFieldGroups,
              prompts: context.prompts?.prompts,
            },
          } as any)}
        >
          <div
            className="space-y-6 px-4"
            data-page="field-new"
            aria-label="Create new field page"
          >
            <Field
              mode="create"
              fieldData={fieldData}
              createFieldAction={createField}
              patchFieldDraftAction={patchFieldDraft}
            />
          </div>
        </FullPageLayout>
      </DraftProviderClient>
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
            pathname="/management/fields/new"
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
  GetFieldIn,
  GetFieldOut,
  PatchFieldDraftIn,
  PatchFieldDraftOut,
  CreateFieldIn,
  CreateFieldOut,
};
