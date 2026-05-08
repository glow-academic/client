/**
 * app/(main)/management/parameters/new/page.tsx
 * New parameter page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
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

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type ParameterGetIn = InputOf<"/parameter/get", "post">;
type ParameterGetOut = OutputOf<"/parameter/get", "post">;
type CreateParameterIn = InputOf<"/parameter/create", "post">;
type CreateParameterOut = OutputOf<"/parameter/create", "post">;
type PatchParameterDraftIn = InputOf<"/parameter/draft", "patch">;
type PatchParameterDraftOut = OutputOf<"/parameter/draft", "patch">;
type GroupParameterIn = InputOf<"/parameter/group", "post">;
type GroupParameterOut = OutputOf<"/parameter/group", "post">;
type ProblemParameterIn = InputOf<"/parameter/problem", "post">;
type ProblemParameterOut = OutputOf<"/parameter/problem", "post">;
type ContextIn = InputOf<"/parameter/context", "post">;
type ContextOut = OutputOf<"/parameter/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getParameterDefault = async (
  input: ParameterGetIn
): Promise<ParameterGetOut> => {
  return api.post("/parameter/get", input, {
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
  return api.post("/parameter/create", input);
}

async function patchParameterDraft(input: PatchParameterDraftIn): Promise<PatchParameterDraftOut> {
  "use server";
  return api.patch("/parameter/draft", input);
}


async function getParameterGroupHistory(groupId: string): Promise<GroupParameterOut> {
  "use server";
  return api.post("/parameter/group", { body: { group_id: groupId } } as GroupParameterIn);
}

type GenerationsIn = InputOf<"/parameter/generations", "post">;
type GenerationsOut = OutputOf<"/parameter/generations", "post">;

async function searchParameterGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/parameter/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createParameterProblem(input: ProblemParameterIn): Promise<ProblemParameterOut> {
  "use server";
  return api.post("/parameter/problem", input);
}

/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getParameterContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/parameter/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getParameterContext();
    return {
      title: context.page_metadata?.new.title,
      description: context.page_metadata?.new.description,
    };
  } catch {
    return { title: "Parameters" };
  }
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

  try {
    // Profile data for providers
    const context = await getParameterContext();
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
    const body = {
      id: null,
      draft_id: q.draftId ?? null,
      ...(q.fieldSearch || q.fieldShowSelected
        ? {
            parameter_fields: {
              ...(q.fieldSearch ? { search: q.fieldSearch } : {}),
              ...(q.fieldShowSelected !== null
                ? { selected: q.fieldShowSelected }
                : {}),
            },
          }
        : {}),
    };
    const input = {
      path: undefined,
      body,
    } as ParameterGetIn;
    const [parameterDetailDefault, draftsResult, groupResult] = await Promise.all([
      getParameterDefault(input),
      api.post("/parameter/drafts", {}),
      api.post("/parameter/group", { body: {} } as GroupParameterIn),
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
              activeSection: "parameter",
              createFeedback: createParameterProblem as any,
            },
            breadcrumbs: [
              { title: "Management", section: "management", url: "/management" },
              {
                title: "Parameters",
                section: "parameters",
                url: "/management/parameters",
              },
              { title: "New Parameter" },
            ],
            toolbar: <SaveToolbar />,
            panelProps: {
              artifactType: "parameter",
              initialPanelPrefs: await readGenerationPanelPrefs(),
              groupId:
                (groupResult as GroupParameterOut & { group_id?: string })?.group_id ??
                null,
              operations: ["draft", "get", "title"],
              getGroupHistory: getParameterGroupHistory,
              searchGroups: searchParameterGroups,
              prompts: context.prompts?.prompts,
            },
          } as any)}
        >
          <div className="space-y-6 px-4" data-page="parameter-new">
            <Parameter
              mode="create"
              parameterData={parameterDetailDefault}
              createParameterAction={createParameter}
              patchParameterDraftAction={patchParameterDraft}
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
          pathname="/management/parameters/new"
        />
      );
    }
    throw error;
  }
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
