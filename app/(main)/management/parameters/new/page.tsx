/**
 * app/(main)/management/parameters/new/page.tsx
 * New parameter page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Parameter from "@/components/artifacts/parameter/Parameter";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type ParameterGetIn = InputOf<"/parameters/get", "post">;
type ParameterGetOut = OutputOf<"/parameters/get", "post">;
type CreateParameterIn = InputOf<"/parameters/create", "post">;
type CreateParameterOut = OutputOf<"/parameters/create", "post">;
type PatchParameterDraftIn = InputOf<"/parameters/draft", "patch">;
type PatchParameterDraftOut = OutputOf<"/parameters/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v5/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v5/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<"/api/v5/resources/descriptions", "post">;
type CreateDraftDescriptionsOut = OutputOf<"/api/v5/resources/descriptions", "post">;
type GroupParameterIn = InputOf<"/parameters/group", "post">;
type GroupParameterOut = OutputOf<"/parameters/group", "post">;
type GenerateParameterIn = InputOf<"/parameters/generate", "post">;
type GenerateParameterOut = OutputOf<"/parameters/generate", "post">;
type ProblemParameterIn = InputOf<"/parameters/problem", "post">;
type ProblemParameterOut = OutputOf<"/parameters/problem", "post">;
type ContextIn = InputOf<"/parameters/context", "post">;
type ContextOut = OutputOf<"/parameters/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getParameterDefault = async (
  input: ParameterGetIn
): Promise<ParameterGetOut> => {
  return api.post("/parameters/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createParameter(
  input: CreateParameterIn,
): Promise<CreateParameterOut> {
  "use server";
  return api.post("/parameters/create", input);
}

async function patchParameterDraft(input: PatchParameterDraftIn): Promise<PatchParameterDraftOut> {
  "use server";
  return api.patch("/parameters/draft", input);
}

async function createNames(input: CreateDraftNamesIn): Promise<CreateDraftNamesOut> {
  "use server";
  return api.post("/resources/names", input);
}

async function createDescriptions(
  input: CreateDraftDescriptionsIn
): Promise<CreateDraftDescriptionsOut> {
  "use server";
  return api.post("/resources/descriptions", input);
}

async function generateParameter(
  input: GenerateParameterIn
): Promise<GenerateParameterOut> {
  "use server";
  return api.post("/parameters/generate", input);
}

async function getParameterGroupHistory(groupId: string): Promise<GroupParameterOut> {
  "use server";
  return api.post("/parameters/group", { body: { group_id: groupId } } as GroupParameterIn);
}

type GenerationsIn = InputOf<"/parameters/generations", "post">;
type GenerationsOut = OutputOf<"/parameters/generations", "post">;

async function searchParameterGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/parameters/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createParameterProblem(input: ProblemParameterIn): Promise<ProblemParameterOut> {
  "use server";
  return api.post("/parameters/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/parameters/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.new.title,
    description: context.page_metadata?.new.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function NewParameterPage({
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
  const context = await api.post("/parameters/context", { body: {} } as ContextIn) as ContextOut;
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

  // Inline server-side parsers for parameter search params (navigation/search params only)
  const parameterSearchParams = {
    draftId: parseAsString,
    // Search/filter params
    fieldSearch: parseAsString,
    fieldShowSelected: parseAsBoolean,
  };
  const loadParameterSearchParams = createLoader(parameterSearchParams);
  const q = loadParameterSearchParams(searchParamsObj);

  // Fetch default parameter detail server-side with filter params and draft_id (parameter_id = null for new mode)
  const input: ParameterGetIn = {
    body: {
      parameter_id: null, // NULL for new mode
      draft_id: q.draftId ?? null,
    } as ParameterGetIn["body"],
  };
  const [parameterDetailDefault, draftsResult, groupResult] = await Promise.all([
    getParameterDefault(input),
    api.post("/parameters/drafts", {}),
    api.post("/parameters/group", { body: {} } as GroupParameterIn),
  ]);

  return (
    <DraftProviderClient drafts={draftsResult.entries ?? []}>
      <FullPageLayout
        profileData={context.profile}
        sessionSnapshot={snapshot}
        initialSidebarOpen={initialSidebarOpen}
        initialPanelOpen={initialPanelOpen}
        sidebarProps={{
          activeSection: "parameter",
          createFeedback: createParameterProblem,
        }}
        breadcrumbs={[
          { title: "Management", section: "management", url: "/management" },
          { title: "Parameters", section: "parameters", url: "/management/parameters" },
          { title: "New Parameter" },
        ]}
        toolbar={<SaveToolbar />}
        panelProps={{
          artifactType: "parameter",
          groupId: (groupResult as GroupParameterOut & { group_id?: string })?.group_id ?? null,
          generateAction: generateParameter,
          permissions: [
            { artifact: "parameter", operation: "draft" },
            { artifact: "parameter", operation: "get" },
            { artifact: "parameter", operation: "docs" },
            { artifact: "parameter", operation: "group" },
          ],
          getGroupHistory: getParameterGroupHistory,
          searchGroups: searchParameterGroups,
        }}
      >
        <div className="space-y-6 px-4" data-page="parameter-new">
          <Parameter
            key={q.draftId || "no-draft"}
            mode="create"
            parameterData={parameterDetailDefault}
            createParameterAction={createParameter}
            patchParameterDraftAction={patchParameterDraft}
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
  PatchParameterDraftIn,
  PatchParameterDraftOut,
  ParameterGetIn,
  ParameterGetOut,
  CreateParameterIn,
  CreateParameterOut,
};
