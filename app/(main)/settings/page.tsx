/**
 * app/(main)/settings/page.tsx
 * Settings list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Settings from "@/components/artifacts/setting/Settings";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { getLayoutContextData } from "@/app/(main)/layout-server";

/** ---- Strong types from OpenAPI ---- */
type SettingsListOut = OutputOf<"/settings/search", "post">;
type GroupSettingIn = InputOf<"/settings/group", "post">;
type GroupSettingOut = OutputOf<"/settings/group", "post">;
type GenerateSettingIn = InputOf<"/settings/generate", "post">;
type GenerateSettingOut = OutputOf<"/settings/generate", "post">;
type GenerationsIn = InputOf<"/settings/generations", "post">;
type GenerationsOut = OutputOf<"/settings/generations", "post">;
type ProblemSettingIn = InputOf<"/settings/problem", "post">;
type ProblemSettingOut = OutputOf<"/settings/problem", "post">;
type ContextIn = InputOf<"/settings/context", "post">;
type ContextOut = OutputOf<"/settings/context", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getSettingsList = async (): Promise<SettingsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/settings/search",
    { body: {} },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    }
  );
};

/** ---- Strongly-typed server actions ---- */
async function generateSetting(
  input: GenerateSettingIn
): Promise<GenerateSettingOut> {
  "use server";
  return api.post("/settings/generate", input);
}

async function getSettingGroupHistory(groupId: string): Promise<GroupSettingOut> {
  "use server";
  return api.post("/settings/group", { body: { group_id: groupId } } as GroupSettingIn);
}

async function searchSettingGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/settings/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createSettingProblem(input: ProblemSettingIn): Promise<ProblemSettingOut> {
  "use server";
  return api.post("/settings/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/settings/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.list.title,
    description: context.page_metadata?.list.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function SettingsPage() {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const { profileData, snapshot } = await getLayoutContextData(session);

  // Fetch list data and group in parallel
  const [listData, groupResult] = await Promise.all([
    getSettingsList(),
    api.post("/settings/group", { body: {} } as GroupSettingIn),
  ]);

  return (
    <FullPageLayout
      profileData={profileData}
      sessionSnapshot={snapshot}
      initialSidebarOpen={initialSidebarOpen}
      initialPanelOpen={initialPanelOpen}
      sidebarProps={{
        activeSection: "setting",
        createFeedback: createSettingProblem,
      }}
      breadcrumbs={[
        { title: "Settings" },
      ]}
      toolbar={<NewArtifactButton label="New Setting" href="/settings/new" />}
      panelProps={{
        artifactType: "setting",
        groupId: (groupResult as GroupSettingOut & { group_id?: string })?.group_id ?? null,
        generateAction: generateSetting,
        permissions: [
          { artifact: "setting", operation: "draft" },
          { artifact: "setting", operation: "get" },
          { artifact: "setting", operation: "docs" },
          { artifact: "setting", operation: "group" },
        ],
        getGroupHistory: getSettingGroupHistory,
        searchGroups: searchSettingGroups,
      }}
    >
      <div className="space-y-6 px-4" data-page="settings-index">
        <Settings listData={listData} />
      </div>
    </FullPageLayout>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { SettingsListOut };
