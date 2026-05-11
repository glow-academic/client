/**
 * app/(main)/training/cohorts/[cohortId]/page.tsx
 * Cohort edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 01/12/2026
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Cohort from "@/components/artifacts/cohort/Cohort";
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
type GetCohortIn = InputOf<"/cohort/get", "post">;
type GetCohortOut = OutputOf<"/cohort/get", "post">;
type UpdateCohortIn = InputOf<"/cohort/update", "post">;
type UpdateCohortOut = OutputOf<"/cohort/update", "post">;
type PatchCohortDraftIn = InputOf<"/cohort/draft", "patch">;
type PatchCohortDraftOut = OutputOf<"/cohort/draft", "patch">;
type GroupCohortIn = InputOf<"/cohort/group", "post">;
type GroupCohortOut = OutputOf<"/cohort/group", "post">;
type ProblemCohortIn = InputOf<"/cohort/problem", "post">;
type ProblemCohortOut = OutputOf<"/cohort/problem", "post">;
type ContextIn = InputOf<"/cohort/context", "post">;
type ContextOut = OutputOf<"/cohort/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getCohort = async (input: GetCohortIn): Promise<GetCohortOut> => {
  return api.post("/cohort/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions ---- */
async function updateCohort(input: UpdateCohortIn): Promise<UpdateCohortOut> {
  "use server";
  return api.post("/cohort/update", input);
}

async function patchCohortDraft(
  input: PatchCohortDraftIn
): Promise<PatchCohortDraftOut> {
  "use server";
  return api.patch("/cohort/draft", input);
}


async function getCohortGroupHistory(groupId: string): Promise<GroupCohortOut> {
  "use server";
  return api.post("/cohort/group", { body: { group_id: groupId } } as GroupCohortIn);
}

type GenerationsIn = InputOf<"/cohort/generations", "post">;
type GenerationsOut = OutputOf<"/cohort/generations", "post">;

async function searchCohortGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/cohort/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createCohortProblem(input: ProblemCohortIn): Promise<ProblemCohortOut> {
  "use server";
  return api.post("/cohort/problem", input);
}

/** Per-item export — scopes to a single ``cohort_id`` so the AI
 *  consumer downstream only sees the row the user is editing. */
async function exportCohortById(cohortId: string): Promise<{
  file_id: string;
  file_name?: string;
}> {
  "use server";
  const result = (await api.post("/cohort/export", {
    body: { cohort_id: cohortId },
  } as unknown as InputOf<"/cohort/export", "post">)) as unknown as {
    file_id: string;
    file_name?: string;
  };
  return {
    file_id: result.file_id,
    ...(result.file_name !== undefined && { file_name: result.file_name }),
  };
}

async function refreshCohort(): Promise<unknown> {
  "use server";
  return api.post("/cohort/refresh", {
    body: {},
  } as unknown as InputOf<"/cohort/refresh", "post">);
}

/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getCohortContextById = cache(
  async (id: string): Promise<ContextOut> =>
    api.post("/cohort/context", { body: { entity_id: id } } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ cohortId: string }>;
}): Promise<Metadata> {
  try {
    const { cohortId } = await params;
    const context = await getCohortContextById(cohortId);
    return {
      title: context.page_metadata?.detail.title,
      description: context.page_metadata?.detail.description,
    };
  } catch {
    return { title: "Cohorts" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

/** ---- Server renders client with typed data and actions ---- */
export default async function CohortEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ cohortId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { cohortId } = await params;
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Parse search params using nuqs
  const params_obj = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params_obj).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Inline server-side parsers for cohort search params
  const cohortSearchParams = {
    draftId: parseAsString,
    descriptionSearch: parseAsString,
    simulationSearch: parseAsString,
    simulationShowSelected: parseAsBoolean,
    profileSearch: parseAsString,
    profileShowSelected: parseAsBoolean,
  };
  const loadCohortSearchParams = createLoader(cohortSearchParams);
  const q = loadCohortSearchParams(searchParamsObj);

  // Check cohort access by fetching detail (will return 403 if no access)
  try {
    const body: GetCohortIn["body"] = {
      id: cohortId,
      draft_id: q.draftId ?? null,
      ...(q.descriptionSearch
        ? {
            descriptions: {
              search: q.descriptionSearch,
            },
          }
        : {}),
      ...(q.simulationSearch || q.simulationShowSelected
        ? {
            simulations: {
              ...(q.simulationSearch ? { search: q.simulationSearch } : {}),
              ...(q.simulationShowSelected !== null
                ? { selected: q.simulationShowSelected }
                : {}),
            },
          }
        : {}),
      ...(q.profileSearch || q.profileShowSelected
        ? {
            profiles: {
              ...(q.profileSearch ? { search: q.profileSearch } : {}),
              ...(q.profileShowSelected !== null
                ? { selected: q.profileShowSelected }
                : {}),
            },
          }
        : {}),
    };

    const input = {
      path: undefined,
      body,
    } as GetCohortIn;

    const [cohortData, context, draftsResult, groupResult] = await Promise.all([
      getCohort(input),
      getCohortContextById(cohortId) as Promise<ContextOut>,
      api.post("/cohort/drafts", { body: {} } as any),
      api.post("/cohort/group", { body: {} } as GroupCohortIn),
    ]);

    const entityName = context.page_metadata?.detail.title ?? "Cohort";
    const snapshot = buildSnapshot(session, context.profile);

    return (
      <DraftProviderClient drafts={(draftsResult.entries ?? []) as any}>
        <FullPageLayout
          {...({
            profileData: context.profile,
            sessionSnapshot: snapshot,
            initialSidebarOpen,
            initialPanelOpen,
            sidebarProps: {
              activeSection: "cohort",
              createFeedback: createCohortProblem as any,
            },
            breadcrumbs: [
              { title: "Training", section: "training", url: "/training" },
              { title: "Cohorts", section: "cohorts", url: "/training/cohorts" },
              { title: entityName },
            ],
            toolbar: (
              <ArtifactToolbarActions
                leftSlot={<SaveToolbar />}
                exportAction={exportCohortById.bind(null, cohortId)}
                refreshAction={refreshCohort}
                bffDownloadPrefix="/api/cohort/download"
              />
            ),
            panelProps: {
              artifactType: "cohort",
              initialPanelPrefs: await readGenerationPanelPrefs(),
              groupId:
                (groupResult as GroupCohortOut & { group_id?: string })?.group_id ??
                null,
              operations: ["draft", "get", "title"],
              getGroupHistory: getCohortGroupHistory,
              searchGroups: searchCohortGroups,
              prompts: context.prompts?.prompts,
            },
          } as any)}
        >
          <div
            className="space-y-6 px-4"
            data-page="cohort-edit"
            data-cohort-id={cohortId}
          >
            <Cohort
              key={q.draftId || "no-draft"}
              cohortId={cohortId}
              cohortData={cohortData}
              updateCohortAction={updateCohort}
              patchCohortDraftAction={patchCohortDraft}
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
            pathname={`/training/cohorts/${cohortId}`}
          />
        );
      }
      if (error.status === 403) {
        return (
          <UnifiedAccessDenied
            reason="department"
            resourceType="cohort"
            redirectPath="/training/cohorts"
          />
        );
      }
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  GetCohortIn,
  GetCohortOut,
  PatchCohortDraftIn,
  PatchCohortDraftOut,
  UpdateCohortIn,
  UpdateCohortOut,
};
