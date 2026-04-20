/**
 * app/(main)/settings/new/page.tsx
 * New setting page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Setting from "@/components/artifacts/setting/Setting";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type GetSettingIn = InputOf<"/setting/get", "post">;
type GetSettingOut = OutputOf<"/setting/get", "post">;
type CreateSettingIn = InputOf<"/setting/create", "post">;
type CreateSettingOut = OutputOf<"/setting/create", "post">;
type PatchSettingDraftIn = InputOf<"/setting/draft", "patch">;
type PatchSettingDraftOut = OutputOf<"/setting/draft", "patch">;
type GroupSettingIn = InputOf<"/setting/group", "post">;
type GroupSettingOut = OutputOf<"/setting/group", "post">;
type GenerateSettingIn = InputOf<"/setting/generate", "post">;
type GenerateSettingOut = OutputOf<"/setting/generate", "post">;
type GenerationsIn = InputOf<"/setting/generations", "post">;
type GenerationsOut = OutputOf<"/setting/generations", "post">;
type ProblemSettingIn = InputOf<"/setting/problem", "post">;
type ProblemSettingOut = OutputOf<"/setting/problem", "post">;
type ContextIn = InputOf<"/setting/context", "post">;
type ContextOut = OutputOf<"/setting/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getSettingDefault = async (
  input: GetSettingIn
): Promise<GetSettingOut> => {
  return api.post("/setting/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createSetting(input: CreateSettingIn): Promise<CreateSettingOut> {
  "use server";
  return api.post("/setting/create", input);
}

async function patchSettingDraft(
  input: PatchSettingDraftIn
): Promise<PatchSettingDraftOut> {
  "use server";
  return api.patch("/setting/draft", input);
}

async function generateSetting(
  input: GenerateSettingIn
): Promise<GenerateSettingOut> {
  "use server";
  return api.post("/setting/generate", input);
}

async function getSettingGroupHistory(groupId: string): Promise<GroupSettingOut> {
  "use server";
  return api.post("/setting/group", { body: { group_id: groupId } } as GroupSettingIn);
}

async function searchSettingGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/setting/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createSettingProblem(input: ProblemSettingIn): Promise<ProblemSettingOut> {
  "use server";
  return api.post("/setting/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await api.post("/setting/context", { body: {} } as ContextIn) as ContextOut;
    return {
      title: context.page_metadata?.new.title,
      description: context.page_metadata?.new.description,
    };
  } catch {
    return { title: "Settings" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function NewSettingPage({
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
    const context = await api.post("/setting/context", { body: {} } as ContextIn) as ContextOut;
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

    // Inline server-side parsers for setting search params (navigation/search params only)
    const settingSearchParams = {
      draftId: parseAsString,
      // Search/filter params
      colorSearch: parseAsString,
    };
    const loadSettingSearchParams = createLoader(settingSearchParams);
    const q = loadSettingSearchParams(searchParamsObj);

    // Fetch default setting detail server-side with filter params and draft_id
    const input = {
      body: {
        id: null,
        draft_id: q.draftId ?? null,
        colors: q.colorSearch ? { search: q.colorSearch } : undefined,
      },
    } as unknown as GetSettingIn;
    const [settingDetailDefault, draftsResult, groupResult] = await Promise.all([
      getSettingDefault(input),
      api.post("/setting/drafts", {} as any),
      api.post("/setting/group", { body: {} } as GroupSettingIn),
    ]);

    return (
      <DraftProviderClient drafts={(draftsResult.entries ?? []) as any}>
        <FullPageLayout
          profileData={context.profile}
          sessionSnapshot={snapshot}
          initialSidebarOpen={initialSidebarOpen ?? false}
          initialPanelOpen={initialPanelOpen ?? false}
          sidebarProps={{
            activeSection: "setting",
            createFeedback: createSettingProblem as any,
          } as any}
          breadcrumbs={[
            { title: "Settings", section: "settings", url: "/settings" },
            { title: "New Setting" },
          ]}
          toolbar={<SaveToolbar />}
          panelProps={{
            artifactType: "setting",
            groupId: (groupResult as GroupSettingOut & { group_id?: string })?.group_id ?? null,
            generateAction: generateSetting,
            operations: ["draft", "get", "group"],
            getGroupHistory: getSettingGroupHistory,
            searchGroups: searchSettingGroups,
            prompts: context.prompts?.prompts,
          } as any}
        >
          <div
            className="space-y-6 px-4"
            data-page="setting-new"
            aria-label="Create new settings page"
          >
            <Setting
              key={q.draftId || "no-draft"}
              settingData={settingDetailDefault}
              createSettingAction={createSetting}
              patchSettingDraftAction={patchSettingDraft}
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
          pathname="/settings/new"
        />
      );
    }
    throw error;
  }
}

// Types are now defined inline in components using InputOf/OutputOf
