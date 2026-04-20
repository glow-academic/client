/**
 * app/(main)/system/rubrics/new/page.tsx
 * New rubric page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Rubric from "@/components/artifacts/rubric/Rubric";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type GetRubricIn = InputOf<"/rubric/get", "post">;
type GetRubricOut = OutputOf<"/rubric/get", "post">;
type CreateRubricIn = InputOf<"/rubric/create", "post">;
type CreateRubricOut = OutputOf<"/rubric/create", "post">;
type PatchRubricDraftIn = InputOf<"/rubric/draft", "patch">;
type PatchRubricDraftOut = OutputOf<"/rubric/draft", "patch">;
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
  return api.patch("/rubric/draft", input);
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
  try {
    const context = await api.post("/rubric/context", { body: {} } as ContextIn) as ContextOut;
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
      pointsSearch: parseAsString,
      pointsShowSelected: parseAsBoolean,
      standardGroupShowSelected: parseAsBoolean,
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
      api.post("/rubric/drafts", {} as InputOf<"/rubric/drafts", "post">),
      api.post("/rubric/group", { body: {} } as GroupRubricIn),
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
              { title: "System", section: "system", url: "/system" },
              { title: "Rubrics", section: "rubrics", url: "/system/rubrics" },
              { title: "New Rubric" },
            ],
            toolbar: <SaveToolbar />,
            panelProps: {
              artifactType: "rubric",
              groupId:
                (groupResult as GroupRubricOut & { group_id?: string | null })
                  ?.group_id ?? "",
              generateAction: generateRubric,
              operations: ["draft", "get", "group"],
              getGroupHistory: getRubricGroupHistory,
              searchGroups: searchRubricGroups,
              ...(context.prompts?.prompts
                ? { prompts: context.prompts.prompts }
                : {}),
            },
          } as any)}
        >
          <div className="space-y-6 px-4" data-page="rubric-new">
            <Rubric
              key={q.draftId || "no-draft"}
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
      "status" in error &&
      (error.status === 401 || error.status === 403)
    ) {
      return (
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname="/system/rubrics/new"
        />
      );
    }
    throw error;
  }
}
