/**
 * app/(main)/management/fields/[fieldId]/page.tsx
 * Field edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Field from "@/components/artifacts/field/Field";
import { DraftProviderClient } from "@/contexts/draft-context";

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
type UpdateFieldIn = InputOf<"/field/update", "post">;
type UpdateFieldOut = OutputOf<"/field/update", "post">;
type PatchFieldDraftIn = InputOf<"/field/draft", "post">;
type PatchFieldDraftOut = OutputOf<"/field/draft", "post">;
type GroupFieldIn = InputOf<"/field/group", "post">;
type GroupFieldOut = OutputOf<"/field/group", "post">;
type ProblemFieldIn = InputOf<"/field/problem", "post">;
type ProblemFieldOut = OutputOf<"/field/problem", "post">;
type ContextIn = InputOf<"/field/context", "post">;
type ContextOut = OutputOf<"/field/context", "post">;

/** ---- Direct fetch (no caching - source of truth) with timeout ---- */
const getField = async (input: GetFieldIn): Promise<GetFieldOut> => {
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
async function updateField(input: UpdateFieldIn): Promise<UpdateFieldOut> {
  "use server";
  return api.post("/field/update", input);
}

async function patchFieldDraft(
  input: PatchFieldDraftIn,
): Promise<PatchFieldDraftOut> {
  "use server";
  return api.post("/field/draft", input);
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

/** Per-item export — scopes to a single ``field_id`` so the AI
 *  consumer downstream only sees the row the user is editing. */
async function exportFieldById(fieldId: string): Promise<{
  file_id: string;
  file_name?: string;
}> {
  "use server";
  const result = (await api.post("/field/export", {
    body: { field_id: fieldId },
  } as unknown as InputOf<"/field/export", "post">)) as unknown as {
    file_id: string;
    file_name?: string;
  };
  return {
    file_id: result.file_id,
    ...(result.file_name !== undefined && { file_name: result.file_name }),
  };
}

async function refreshField(): Promise<unknown> {
  "use server";
  return api.post("/field/refresh", {
    body: {},
  } as unknown as InputOf<"/field/refresh", "post">);
}

/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getFieldContextById = cache(
  async (id: string): Promise<ContextOut> =>
    api.post("/field/context", { body: { entity_id: id } } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ fieldId: string }>;
}): Promise<Metadata> {
  try {
    const { fieldId } = await params;
    const context = await getFieldContextById(fieldId);
    return {
      title: context.page_metadata?.detail.title,
      description: context.page_metadata?.detail.description,
    };
  } catch {
    return { title: "Fields" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

/** ---- Server renders client with typed data and actions ---- */
export default async function FieldEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ fieldId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { fieldId } = await params;
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

  // Inline server-side parsers for field search params
  const fieldSearchParams = {
    draftId: parseAsString,
    descriptionSearch: parseAsString,
    conditionalParameterSearch: parseAsString,
    conditionalParameterShowSelected: parseAsBoolean,
  };
  const loadFieldSearchParams = createLoader(fieldSearchParams);
  const q = loadFieldSearchParams(searchParamsObj);

  try {
    const body = {
      id: fieldId,
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

    const [fieldData, context, draftsResult, groupResult] = await Promise.all([
      getField(input),
      getFieldContextById(fieldId) as Promise<ContextOut>,
      api.post("/field/drafts", { body: {} } as any),
      api.post("/field/group", { body: {} } as GroupFieldIn),
    ]);
    const snapshot = buildSnapshot(session, context.profile);

    const entityName = context.page_metadata?.detail.title;

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
              { title: entityName },
            ],
            toolbar: (
              <ArtifactToolbarActions
                leftSlot={<SaveToolbar />}
                exportAction={exportFieldById.bind(null, fieldId)}
                refreshAction={refreshField}
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
            data-page="field-edit"
            data-field-id={fieldId}
          >
            <Field
              key={q.draftId || "no-draft"}
              fieldId={fieldId}
              mode="edit"
              fieldData={fieldData}
              updateFieldAction={updateField}
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
            pathname={`/management/fields/${fieldId}`}
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
  UpdateFieldIn,
  UpdateFieldOut,
};
