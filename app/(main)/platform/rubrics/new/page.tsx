/**
 * app/(main)/platform/rubrics/new/page.tsx
 * New rubric page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Rubric from "@/components/artifacts/rubric/Rubric";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type GetRubricIn = InputOf<"/rubric/get", "post">;
type GetRubricOut = OutputOf<"/rubric/get", "post">;
type CreateRubricIn = InputOf<"/rubric/create", "post">;
type CreateRubricOut = OutputOf<"/rubric/create", "post">;
type PatchRubricDraftIn = InputOf<"/rubric/draft", "post">;
type PatchRubricDraftOut = OutputOf<"/rubric/draft", "post">;
type GroupRubricIn = InputOf<"/rubric/group", "post">;
type GroupRubricOut = OutputOf<"/rubric/group", "post">;
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
  pointsSearch: string | null,
  pointsShowSelected: boolean | null,
  standardGroupShowSelected: boolean | null,
): Promise<GetRubricOut> => {
  return api.post(
    "/rubric/get",
    ({
      body: {
        id: null,
        draft_id: draftId || null,
        descriptions:
          descriptionSearch
            ? { search: descriptionSearch || undefined }
            : undefined,
        points:
          pointsSearch || pointsShowSelected
            ? {
                search: pointsSearch || undefined,
                selected: pointsShowSelected || undefined,
              }
            : undefined,
        standard_groups:
          standardGroupSearch || standardGroupShowSelected
            ? {
                search: standardGroupSearch || undefined,
                selected: standardGroupShowSelected || undefined,
              }
            : undefined,
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
  return api.post("/rubric/draft", input);
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

// NOTE: /rubric/export REQUIRES a ``rubric_id`` and we don't have one
// here on the /new page. Omit ``exportAction``/``bffDownloadPrefix`` so
// the toolbar renders only [Drafts ▾] (leftSlot) + [↻ Refresh]. The
// list/detail pages still wire export normally.
async function refreshRubrics(): Promise<unknown> {
  "use server";
  return api.post("/rubric/refresh", {
    body: {},
  } as unknown as InputOf<"/rubric/refresh", "post">);
}

/** ---- GenerationPanel server actions ---- */
async function getRubricGroup(input: GroupRubricIn): Promise<GroupRubricOut> {
  "use server";
  return api.post("/rubric/group", input);
}

async function searchRubricGenerations(input: GenerationsIn): Promise<GenerationsOut> {
  "use server";
  return api.post("/rubric/generations", input);
}


/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getRubricContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/rubric/context", { body: { page_limit: 50, page_offset: 0 } }) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getRubricContext();
    return {
      title: context.page_metadata?.new.title,
      description: context.page_metadata?.new.description,
    };
  } catch {
    return { title: "Rubrics" };
  }
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

  try {
    // Profile data for providers
    const context = await getRubricContext();
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
      pointsSearch: parseAsString,
      pointsShowSelected: parseAsBoolean,
      standardGroupShowSelected: parseAsBoolean,
      groupId: parseAsString,
      groupSearch: parseAsString,
    };
    const loadRubricSearchParams = createLoader(rubricSearchParams);
    const q = loadRubricSearchParams(searchParamsObj);

    // SSR data fetches
    const [rubricData, draftsResult, groupResult] = await Promise.all([
      getRubric(
        q.draftId ?? null,
        q.descriptionSearch ?? null,
        q.standardGroupSearch ?? null,
        q.pointsSearch ?? null,
        q.pointsShowSelected ?? null,
        q.standardGroupShowSelected ?? null,
      ),
      api.post("/rubric/drafts", { body: { page_limit: 50, page_offset: 0 } }),
      api.post(
        "/rubric/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupRubricIn,
      ),
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
              activeSection: "rubric",
              createFeedback: createRubricProblem as unknown as (
                input: Record<string, unknown>,
              ) => Promise<Record<string, unknown>>,
            },
            breadcrumbs: [
              { title: "Platform", section: "platform", url: "/platform" },
              { title: "Rubrics", section: "rubrics", url: "/platform/rubrics" },
              { title: "New Rubric" },
            ],
            toolbar: (
              <ArtifactToolbarActions
                leftSlot={<SaveToolbar />}
                refreshAction={refreshRubrics}
              />
            ),
            panelProps: {
              artifactType: "rubric",
              initialPanelPrefs: await readGenerationPanelPrefs(),
              groupId:
                (groupResult as GroupRubricOut & { group_id?: string | null })
                  ?.group_id ?? "",
              groupName:
                (groupResult as GroupRubricOut & { name?: string | null })?.name ?? null,
              operations: ["draft", "get", "title"],
              getGroupHistory: getRubricGroupHistory,
              searchGroups: searchRubricGroups,
              ...(context.prompts?.prompts
                ? { prompts: context.prompts.prompts }
                : {}),
              getGroupAction: getRubricGroup as PanelProps["getGroupAction"],
              searchGenerationsAction:
                searchRubricGenerations as PanelProps["searchGenerationsAction"],
            },
          } as any)}
        >
          <div className="space-y-6 px-4" data-page="rubric-new">
            <Rubric
              rubricData={rubricData}
              createRubricAction={createRubric}
              patchRubricDraftAction={patchRubricDraft}
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
            pathname="/platform/rubrics/new"
          />
        );
      }
      if (error.status === 403) {
        return (
          <UnifiedAccessDenied
            reason="department"
            resourceType="rubric"
            redirectPath="/platform/rubrics"
          />
        );
      }
    }
    throw error;
  }
}
