/**
 * app/(main)/system/rubrics/new/page.tsx
 * New rubric page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Rubric from "@/components/artifacts/rubric/Rubric";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsString } from "nuqs/server";

import { getLayoutContextData } from "@/app/(main)/layout-server";

/** ---- Strong types from OpenAPI ---- */
type GetRubricIn = InputOf<"/rubrics/get", "post">;
type GetRubricOut = OutputOf<"/rubrics/get", "post">;
type CreateRubricIn = InputOf<"/rubrics/create", "post">;
type CreateRubricOut = OutputOf<"/rubrics/create", "post">;
type PatchRubricDraftIn = InputOf<"/rubrics/draft", "patch">;
type PatchRubricDraftOut = OutputOf<"/rubrics/draft", "patch">;
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
type CreateDraftPointsIn = InputOf<"/api/v5/resources/points", "post">;
type CreateDraftPointsOut = OutputOf<"/api/v5/resources/points", "post">;
type CreateDraftStandardGroupsIn = InputOf<
  "/api/v5/resources/standard_groups",
  "post"
>;
type CreateDraftStandardGroupsOut = OutputOf<
  "/api/v5/resources/standard_groups",
  "post"
>;
type GroupRubricIn = InputOf<"/rubrics/group", "post">;
type GroupRubricOut = OutputOf<"/rubrics/group", "post">;
type GenerateRubricIn = InputOf<"/rubrics/generate", "post">;
type GenerateRubricOut = OutputOf<"/rubrics/generate", "post">;
type GenerationsIn = InputOf<"/rubrics/generations", "post">;
type GenerationsOut = OutputOf<"/rubrics/generations", "post">;
type ProblemRubricIn = InputOf<"/rubrics/problem", "post">;
type ProblemRubricOut = OutputOf<"/rubrics/problem", "post">;
type ContextIn = InputOf<"/rubrics/context", "post">;
type ContextOut = OutputOf<"/rubrics/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getRubric = async (
  draftId: string | null,
  descriptionSearch: string | null,
  standardGroupSearch: string | null,
): Promise<GetRubricOut> => {
  return api.post(
    "/rubrics/get",
    ({
      body: {
        rubric_id: null,
        draft_id: draftId || null,
        description_search: descriptionSearch || null,
        standard_group_search: standardGroupSearch || null,
      },
    } as GetRubricIn),
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Strongly-typed server actions ---- */
async function createRubric(input: CreateRubricIn): Promise<CreateRubricOut> {
  "use server";
  return api.post("/rubrics/create", input);
}

async function patchRubricDraft(
  input: PatchRubricDraftIn
): Promise<PatchRubricDraftOut> {
  "use server";
  return api.patch("/rubrics/draft", input);
}

async function createDraftNames(
  input: CreateDraftNamesIn
): Promise<CreateDraftNamesOut> {
  "use server";
  return api.post("/resources/names", input);
}

async function createDraftDescriptions(
  input: CreateDraftDescriptionsIn
): Promise<CreateDraftDescriptionsOut> {
  "use server";
  return api.post("/resources/descriptions", input);
}

async function createDraftPoints(
  input: CreateDraftPointsIn
): Promise<CreateDraftPointsOut> {
  "use server";
  return api.post("/resources/points", input);
}

async function createDraftStandardGroups(
  input: CreateDraftStandardGroupsIn
): Promise<CreateDraftStandardGroupsOut> {
  "use server";
  return api.post("/resources/standard_groups", input);
}

async function generateRubric(
  input: GenerateRubricIn
): Promise<GenerateRubricOut> {
  "use server";
  return api.post("/rubrics/generate", input);
}

async function getRubricGroupHistory(groupId: string): Promise<GroupRubricOut> {
  "use server";
  return api.post("/rubrics/group", { body: { group_id: groupId } } as GroupRubricIn);
}

async function searchRubricGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/rubrics/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createRubricProblem(input: ProblemRubricIn): Promise<ProblemRubricOut> {
  "use server";
  return api.post("/rubrics/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/rubrics/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.new.title,
    description: context.page_metadata?.new.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function NewRubricPage({
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

  // Inline server-side parsers for rubric search params
  const rubricSearchParams = {
    draftId: parseAsString,
    descriptionSearch: parseAsString,
    standardGroupSearch: parseAsString,
  };
  const loadRubricSearchParams = createLoader(rubricSearchParams);
  const q = loadRubricSearchParams(searchParamsObj);

  // SSR data fetches
  const [rubricData, draftsResult, groupResult] = await Promise.all([
    getRubric(
      q.draftId ?? null,
      q.descriptionSearch ?? null,
      q.standardGroupSearch ?? null,
    ),
    api.post("/rubrics/drafts", {}),
    api.post("/rubrics/group", { body: {} } as GroupRubricIn),
  ]);

  return (
    <DraftProviderClient drafts={draftsResult.entries ?? []}>
      <FullPageLayout
        profileData={profileData}
        sessionSnapshot={snapshot}
        initialSidebarOpen={initialSidebarOpen}
        initialPanelOpen={initialPanelOpen}
        sidebarProps={{
          activeSection: "rubric",
          createFeedback: createRubricProblem,
        }}
        breadcrumbs={[
          { title: "System", section: "system", url: "/system" },
          { title: "Rubrics", section: "rubrics", url: "/system/rubrics" },
          { title: "New Rubric" },
        ]}
        toolbar={<SaveToolbar />}
        panelProps={{
          artifactType: "rubric",
          groupId: (groupResult as GroupRubricOut & { group_id?: string })?.group_id ?? null,
          generateAction: generateRubric,
          permissions: [
            { artifact: "rubric", operation: "draft" },
            { artifact: "rubric", operation: "get" },
            { artifact: "rubric", operation: "docs" },
            { artifact: "rubric", operation: "group" },
          ],
          getGroupHistory: getRubricGroupHistory,
          searchGroups: searchRubricGroups,
        }}
      >
        <div className="space-y-6 px-4" data-page="rubric-new">
          <Rubric
            key={q.draftId || "no-draft"}
            rubricData={rubricData}
            createRubricAction={createRubric}
            patchRubricDraftAction={patchRubricDraft}
            createNamesAction={createDraftNames}
            createDescriptionsAction={createDraftDescriptions}
            createPointsAction={createDraftPoints}
            createStandardGroupsAction={createDraftStandardGroups}
          />
        </div>
      </FullPageLayout>
    </DraftProviderClient>
  );
}
