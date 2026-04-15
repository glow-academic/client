/**
 * app/(main)/management/fields/new/page.tsx
 * New field page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Field from "@/components/artifacts/field/Field";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

import { getLayoutContextData } from "@/app/(main)/layout-server";

/** ---- Strong types from OpenAPI ---- */
type GetFieldIn = InputOf<"/fields/get", "post">;
type GetFieldOut = OutputOf<"/fields/get", "post">;
type CreateFieldIn = InputOf<"/fields/create", "post">;
type CreateFieldOut = OutputOf<"/fields/create", "post">;
type PatchFieldDraftIn = InputOf<"/fields/draft", "patch">;
type PatchFieldDraftOut = OutputOf<"/fields/draft", "patch">;
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
type GroupFieldIn = InputOf<"/fields/group", "post">;
type GroupFieldOut = OutputOf<"/fields/group", "post">;
type GenerateFieldIn = InputOf<"/fields/generate", "post">;
type GenerateFieldOut = OutputOf<"/fields/generate", "post">;
type ProblemFieldIn = InputOf<"/fields/problem", "post">;
type ProblemFieldOut = OutputOf<"/fields/problem", "post">;
type ContextIn = InputOf<"/fields/context", "post">;
type ContextOut = OutputOf<"/fields/context", "post">;

/** ---- Direct fetch for default field data with timeout ---- */
const getFieldDefault = async (input: GetFieldIn): Promise<GetFieldOut> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const result = await api.post("/fields/get", input, {
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
  return api.post("/fields/create", input);
}

async function patchFieldDraft(
  input: PatchFieldDraftIn
): Promise<PatchFieldDraftOut> {
  "use server";
  return api.patch("/fields/draft", input);
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
  return api.post("/fields/generate", input);
}

async function getFieldGroupHistory(groupId: string): Promise<GroupFieldOut> {
  "use server";
  return api.post("/fields/group", { body: { group_id: groupId } } as GroupFieldIn);
}

type GenerationsIn = InputOf<"/fields/generations", "post">;
type GenerationsOut = OutputOf<"/fields/generations", "post">;

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
    title: context.page_metadata?.new.title,
    description: context.page_metadata?.new.description,
  };
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

  // Profile data for providers
  const { profileData, snapshot } = await getLayoutContextData(session);

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
  const input: GetFieldIn = {
    body: {
      field_id: null, // NULL for new mode
      draft_id: q.draftId ?? null,
      description_search: q.descriptionSearch ?? null,
      conditional_parameter_search: q.conditionalParameterSearch ?? null,
      conditional_parameter_show_selected:
        q.conditionalParameterShowSelected ?? null,
    } as GetFieldIn["body"],
  };
  const [fieldData, draftsResult, groupResult] = await Promise.all([
    getFieldDefault(input),
    api.post("/fields/drafts", {}),
    api.post("/fields/group", { body: {} } as GroupFieldIn),
  ]);

  return (
    <DraftProviderClient drafts={draftsResult.entries ?? []}>
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
          { title: "Fields", section: "fields", url: "/management/fields" },
          { title: "New Field" },
        ]}
        toolbar={<SaveToolbar />}
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
        <div
          className="space-y-6 px-4"
          data-page="field-new"
          aria-label="Create new field page"
        >
          <Field
            key={q.draftId || "no-draft"}
            fieldData={fieldData}
            createFieldAction={createField}
            patchFieldDraftAction={patchFieldDraft}
            createNamesAction={createNames}
            createDescriptionsAction={createDescriptions}
          />
        </div>
      </FullPageLayout>
    </DraftProviderClient>
  );
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
