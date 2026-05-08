/**
 * app/(main)/settings/page.tsx
 * Settings list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Settings from "@/components/artifacts/setting/Settings";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { readViewCookie } from "@/lib/view-cookie";
import { loadSettingsSearchParams } from "@/lib/search-params/settings";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type SettingsListOut = OutputOf<"/setting/search", "post">;
type DeleteSettingIn = InputOf<"/setting/delete", "post">;
type DeleteSettingOut = OutputOf<"/setting/delete", "post">;
type UpdateSettingIn = InputOf<"/setting/update", "post">;
type UpdateSettingOut = OutputOf<"/setting/update", "post">;
type GroupSettingIn = InputOf<"/setting/group", "post">;
type GroupSettingOut = OutputOf<"/setting/group", "post">;
type GenerationsIn = InputOf<"/setting/generations", "post">;
type GenerationsOut = OutputOf<"/setting/generations", "post">;
type ProblemSettingIn = InputOf<"/setting/problem", "post">;
type ProblemSettingOut = OutputOf<"/setting/problem", "post">;
type ContextIn = InputOf<"/setting/context", "post">;
type ContextOut = OutputOf<"/setting/context", "post">;

/** ---- Body type for settings list request ----
 *
 * Today the ``/setting/search`` route ignores its body (the request
 * model is empty). The client still threads a body shape so the bulk
 * delete/update all-matching path can re-use the same envelope —
 * the bulk endpoints accept these filter fields as the row-narrowing
 * filter when ``all=true``. Keep field names aligned with the bulk
 * delete/update validators (``DeleteSettingApiRequest`` /
 * ``UpdateSettingApiRequest``) so the body passes through unchanged.
 */
type SettingsListBody = {
  search?: string | null;
  flag_ids?: string[] | null;
  provider_ids?: string[] | null;
  auth_ids?: string[] | null;
  system_ids?: string[] | null;
  filter_department_ids?: string[] | null;
  flag_search?: string | null;
  provider_search?: string | null;
  auth_search?: string | null;
  system_search?: string | null;
  department_search?: string | null;
};

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getSettingsList = async (): Promise<SettingsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/setting/search",
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
async function deleteSetting(
  input: DeleteSettingIn
): Promise<DeleteSettingOut> {
  "use server";
  return api.post("/setting/delete", input);
}

async function updateSetting(
  input: UpdateSettingIn
): Promise<UpdateSettingOut> {
  "use server";
  return api.post("/setting/update", input);
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

/** ---- GenerationPanel server actions ---- */
async function getSettingGroup(input: GroupSettingIn): Promise<GroupSettingOut> {
  "use server";
  return api.post("/setting/group", input);
}

async function searchSettingGenerations(input: GenerationsIn): Promise<GenerationsOut> {
  "use server";
  return api.post("/setting/generations", input);
}


/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getSettingContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/setting/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getSettingContext();
    return {
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Settings" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface SettingsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const session = await getSession();
  const q = loadSettingsSearchParams(await searchParams);

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  try {
    // Profile data for providers
    const context = await getSettingContext();
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/settings", context.profile.role_permissions);

    // The all-matching bulk delete/update path forwards this body
    // verbatim as the filter envelope. Today no filter fields are
    // URL-driven on the settings list, so this is empty — see the
    // "Known gaps" note in ``project_bulk_write_pattern.md``: until
    // filters migrate to nuqs, all-matching targets every row the
    // user can write, not the on-screen filtered subset.
    const currentSearchBody: SettingsListBody = {};

    // Fetch list data, view cookie, and group in parallel
    const [listData, initialColumnVisibility, groupResult] = await Promise.all([
      getSettingsList(),
      readViewCookie("settings"),
      api.post(
        "/setting/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupSettingIn,
      ),
    ]);

    return (
      <FullPageLayout
        profileData={context.profile}
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
          initialPanelPrefs: await readGenerationPanelPrefs(),
          groupId: (groupResult as GroupSettingOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as GroupSettingOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          operations: ["draft", "get", "title"],
          getGroupHistory: getSettingGroupHistory,
          searchGroups: searchSettingGroups,
          prompts: context.prompts?.prompts,
          getGroupAction: getSettingGroup as PanelProps["getGroupAction"],
          searchGenerationsAction:
            searchSettingGenerations as PanelProps["searchGenerationsAction"],
        }}
      >
        <div className="space-y-6 px-4" data-page="settings-index">
          <Settings
            listData={listData}
            initialColumnVisibility={initialColumnVisibility}
            deleteSettingAction={deleteSetting}
            updateSettingAction={updateSetting}
            currentSearchBody={currentSearchBody}
            totalCount={listData.settings?.length ?? 0}
          />
        </div>
      </FullPageLayout>
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
          pathname="/settings"
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  SettingsListOut,
  SettingsListBody,
  DeleteSettingIn,
  DeleteSettingOut,
  UpdateSettingIn,
  UpdateSettingOut,
};
