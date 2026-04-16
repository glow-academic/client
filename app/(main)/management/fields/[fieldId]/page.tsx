/**
 * app/(main)/management/fields/[fieldId]/page.tsx
 * Field edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
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

/** ---- Strong types from OpenAPI ---- */
type GetFieldIn = InputOf<"/field/get", "post">;
type GetFieldOut = OutputOf<"/field/get", "post">;
type UpdateFieldIn = InputOf<"/field/update", "post">;
type UpdateFieldOut = OutputOf<"/field/update", "post">;
type PatchFieldDraftIn = InputOf<"/field/draft", "patch">;
type PatchFieldDraftOut = OutputOf<"/field/draft", "patch">;
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
type GroupFieldIn = InputOf<"/field/group", "post">;
type GroupFieldOut = OutputOf<"/field/group", "post">;
type GenerateFieldIn = InputOf<"/field/generate", "post">;
type GenerateFieldOut = OutputOf<"/field/generate", "post">;
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
  input: PatchFieldDraftIn
): Promise<PatchFieldDraftOut> {
  "use server";
  return api.patch("/field/draft", input);
}

async function createNames(
  input: CreateDraftNamesIn
): Promise<CreateDraftNamesOut> {
  "use server";
  return api.post("/resources/names", input);
}

async function createDescriptions(
  input: CreateDraftDescriptionsIn
): Promise<CreateDraftDescriptionsOut> {
  "use server";
  return api.post("/resources/descriptions", input);
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

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ fieldId: string }>;
}): Promise<Metadata> {
  try {
    const { fieldId } = await params;
    const context = await api.post("/field/context", { body: { entity_id: fieldId } } as ContextIn) as ContextOut;
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

  // Profile data for providers
  const context = await api.post("/field/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

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
    const input: GetFieldIn = {
      body: {
        field_id: fieldId,
        draft_id: q.draftId ?? null,
        description_search: q.descriptionSearch ?? null,
        conditional_parameter_search: q.conditionalParameterSearch ?? null,
        conditional_parameter_show_selected:
          q.conditionalParameterShowSelected ?? null,
      } as GetFieldIn["body"],
    };

    const [fieldData, context, draftsResult, groupResult] = await Promise.all([
      getField(input),
      api.post("/field/context", { body: { entity_id: fieldId } } as ContextIn) as Promise<ContextOut>,
      api.post("/field/drafts", {}),
      api.post("/field/group", { body: {} } as GroupFieldIn),
    ]);

    const entityName = context.page_metadata?.detail.title;

    return (
      <DraftProviderClient drafts={draftsResult.entries ?? []}>
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
            { title: "Fields", section: "fields", url: "/management/fields" },
            { title: entityName },
          ]}
          toolbar={<SaveToolbar />}
          panelProps={{
            artifactType: "field",
            groupId: (groupResult as GroupFieldOut & { group_id?: string })?.group_id ?? null,
            generateAction: generateField,
            operations: ["draft", "get", "group"],
            getGroupHistory: getFieldGroupHistory,
            searchGroups: searchFieldGroups,
            prompts: context.prompts?.prompts,
          }}
        >
          <div
            className="space-y-6 px-4"
            data-page="field-edit"
            data-field-id={fieldId}
          >
            <Field
              key={q.draftId || "no-draft"}
              fieldId={fieldId}
              fieldData={fieldData}
              updateFieldAction={updateField}
              patchFieldDraftAction={patchFieldDraft}
              createNamesAction={createNames}
              createDescriptionsAction={createDescriptions}
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
          resourceType="field"
          redirectPath="/management/fields"
        />
      );
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
