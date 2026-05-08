/**
 * app/(main)/training/cohorts/new/page.tsx
 * New cohort page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 01/12/2026
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Cohort from "@/components/artifacts/cohort/Cohort";

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
type CreateCohortIn = InputOf<"/cohort/create", "post">;
type CreateCohortOut = OutputOf<"/cohort/create", "post">;
type PatchCohortDraftIn = InputOf<"/cohort/draft", "patch">;
type PatchCohortDraftOut = OutputOf<"/cohort/draft", "patch">;
type GroupCohortIn = InputOf<"/cohort/group", "post">;
type GroupCohortOut = OutputOf<"/cohort/group", "post">;
type ProblemCohortIn = InputOf<"/cohort/problem", "post">;
type ProblemCohortOut = OutputOf<"/cohort/problem", "post">;
type ContextIn = InputOf<"/cohort/context", "post">;
type ContextOut = OutputOf<"/cohort/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getCohortDefault = async (input: GetCohortIn): Promise<GetCohortOut> => {
  return api.post("/cohort/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions ---- */
async function createCohort(input: CreateCohortIn): Promise<CreateCohortOut> {
  "use server";
  return api.post("/cohort/create", input);
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

/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getCohortContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/cohort/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getCohortContext();
    return {
      title: context.page_metadata?.new.title,
      description: context.page_metadata?.new.description,
    };
  } catch {
    return { title: "Cohorts" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function NewCohortPage({
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
    // Profile data for providers (until /cohorts/context returns full profile)
    const context = await getCohortContext();
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

    // Fetch default cohort detail server-side with filter params and draft_id
    const body: GetCohortIn["body"] = {
      id: null,
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

    const [cohortData, draftsResult, groupResult] = await Promise.all([
      getCohortDefault(input),
      api.post("/cohort/drafts", {}),
      api.post("/cohort/group", { body: {} } as GroupCohortIn),
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
              activeSection: "cohort",
              createFeedback: createCohortProblem as any,
            },
            breadcrumbs: [
              { title: "Training", section: "training", url: "/training" },
              { title: "Cohorts", section: "cohorts", url: "/training/cohorts" },
              { title: "New Cohort" },
            ],
            toolbar: <SaveToolbar />,
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
            data-page="cohort-new"
            aria-label="Create new cohort page"
          >
            <Cohort
              cohortData={cohortData}
              createCohortAction={createCohort}
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
      "status" in error &&
      (error.status === 401 || error.status === 403)
    ) {
      return (
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname="/training/cohorts/new"
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  GetCohortIn,
  GetCohortOut,
  PatchCohortDraftIn,
  PatchCohortDraftOut,
  CreateCohortIn,
  CreateCohortOut,
};
