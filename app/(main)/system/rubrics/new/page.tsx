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

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type GetRubricIn = InputOf<"/rubric/get", "post">;
type GetRubricOut = OutputOf<"/rubric/get", "post">;
type CreateRubricIn = InputOf<"/rubric/create", "post">;
type CreateRubricOut = OutputOf<"/rubric/create", "post">;
type PatchRubricDraftIn = InputOf<"/rubric/draft", "patch">;
type PatchRubricDraftOut = OutputOf<"/rubric/draft", "patch">;
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
type GroupRubricIn = InputOf<"/rubric/group", "post">;
type GroupRubricOut = OutputOf<"/rubric/group", "post">;
type GenerateRubricIn = InputOf<"/rubric/generate", "post">;
type GenerateRubricOut = OutputOf<"/rubric/generate", "post">;
type GenerationsIn = InputOf<"/rubric/generations", "post">;
type GenerationsOut = OutputOf<"/rubric/generations", "post">;
type ProblemRubricIn = InputOf<"/rubric/problem", "post">;
type ProblemRubricOut = OutputOf<"/rubric/problem", "post">;
type ContextIn = InputOf<"/rubric/context", "post">;
type ContextOut = OutputOf<"/rubric/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getRubric = async (
  draftId: string | null,
  descriptionSearch: string | null,
  standardGroupSearch: string | null,
): Promise<GetRubricOut> => {
  return api.post(
    "/rubric/get",
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
  return api.post("/rubric/create", input);
}

async function patchRubricDraft(
  input: PatchRubricDraftIn
): Promise<PatchRubricDraftOut> {
  "use server";
  return api.patch("/rubric/draft", input);
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
  return api.post("/rubric/generate", input);
}

async function getRubricGroupHistory(groupId: string): Promise<GroupRubricOut> {
  "use server";
  return api.post("/rubric/group", { body: { group_id: groupId } } as GroupRubricIn);
}

async function searchRubricGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/rubric/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createRubricProblem(input: ProblemRubricIn): Promise<ProblemRubricOut> {
  "use server";
  return api.post("/rubric/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/rubric/context", { body: {} } as ContextIn) as ContextOut;
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
  const context = await api.post("/rubric/context", { body: {} } as ContextIn) as ContextOut;
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
    api.post("/rubric/drafts", {}),
    api.post("/rubric/group", { body: {} } as GroupRubricIn),
  ]);

  return (
    <DraftProviderClient drafts={draftsResult.entries ?? []}>
      <FullPageLayout
        profileData={context.profile}
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
