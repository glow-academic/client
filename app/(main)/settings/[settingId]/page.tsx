/**
 * app/(main)/settings/[settingId]/page.tsx
 * Setting edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Setting from "@/components/artifacts/setting/Setting";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type GetSettingIn = InputOf<"/setting/get", "post">;
type GetSettingOut = OutputOf<"/setting/get", "post">;
type CreateSettingIn = InputOf<"/setting/create", "post">;
type CreateSettingOut = OutputOf<"/setting/create", "post">;
type UpdateSettingIn = InputOf<"/setting/update", "post">;
type UpdateSettingOut = OutputOf<"/setting/update", "post">;
type PatchSettingDraftIn = InputOf<"/setting/draft", "post">;
type PatchSettingDraftOut = OutputOf<"/setting/draft", "post">;
type GroupSettingIn = InputOf<"/setting/group", "post">;
type GroupSettingOut = OutputOf<"/setting/group", "post">;
type GenerationsIn = InputOf<"/setting/generations", "post">;
type GenerationsOut = OutputOf<"/setting/generations", "post">;
type ProblemSettingIn = InputOf<"/setting/problem", "post">;
type ProblemSettingOut = OutputOf<"/setting/problem", "post">;
type ContextIn = InputOf<"/setting/context", "post">;
type ContextOut = OutputOf<"/setting/context", "post">;
type DecryptSettingIn = InputOf<"/setting/decrypt", "post">;
type DecryptSettingOut = OutputOf<"/setting/decrypt", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getSetting = async (input: GetSettingIn): Promise<GetSettingOut> => {
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

async function updateSetting(input: UpdateSettingIn): Promise<UpdateSettingOut> {
  "use server";
  return api.post("/setting/update", input);
}

async function patchSettingDraft(
  input: PatchSettingDraftIn
): Promise<PatchSettingDraftOut> {
  "use server";
  return api.post("/setting/draft", input);
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

/** Per-item export — scopes to a single ``setting_id`` so the AI
 *  consumer downstream only sees the row the user is editing. */
async function exportSettingById(settingId: string): Promise<{
  file_id: string;
  file_name?: string;
}> {
  "use server";
  const result = (await api.post("/setting/export", {
    body: { setting_id: settingId },
  } as unknown as InputOf<"/setting/export", "post">)) as unknown as {
    file_id: string;
    file_name?: string;
  };
  return {
    file_id: result.file_id,
    ...(result.file_name !== undefined && { file_name: result.file_name }),
  };
}

async function refreshSetting(): Promise<unknown> {
  "use server";
  return api.post("/setting/refresh", {
    body: {},
  } as unknown as InputOf<"/setting/refresh", "post">);
}

async function decryptSetting(input: DecryptSettingIn): Promise<DecryptSettingOut> {
  "use server";
  return api.post("/setting/decrypt", input);
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
const getSettingContextById = cache(
  async (id: string): Promise<ContextOut> =>
    api.post("/setting/context", { body: { entity_id: id } } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ settingId: string }>;
}): Promise<Metadata> {
  try {
    const { settingId } = await params;
    const context = await getSettingContextById(settingId);
    return {
      title: context.page_metadata?.detail.title,
      description: context.page_metadata?.detail.description,
    };
  } catch {
    return { title: "Settings" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

/** ---- Server renders client with typed data and actions ---- */
export default async function SettingEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ settingId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { settingId } = await params;
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/setting/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

  // Parse search params using nuqs
  const paramsObj = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(paramsObj).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Inline server-side parsers for setting search params
  const settingSearchParams = {
    draftId: parseAsString,
    colorSearch: parseAsString,
    groupId: parseAsString,
    groupSearch: parseAsString,
  };
  const loadSettingSearchParams = createLoader(settingSearchParams);
  const q = loadSettingSearchParams(searchParamsObj);

  // Fetch setting detail (always fresh - source of truth) with filter params
  try {
    const input = {
      body: {
        id: settingId,
        draft_id: q.draftId ?? null,
        colors: q.colorSearch ? { search: q.colorSearch } : undefined,
      },
    } as unknown as GetSettingIn;
    const [settingDetail, context, draftsResult, groupResult] = await Promise.all([
      getSetting(input),
      getSettingContextById(settingId) as Promise<ContextOut>,
      api.post("/setting/drafts", {} as any),
      api.post(
        "/setting/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupSettingIn,
      ),
    ]);

    const entityName = context.page_metadata?.detail.title ?? "Setting";

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
            { title: entityName },
          ]}
          toolbar={
            <ArtifactToolbarActions
              leftSlot={<SaveToolbar />}
              exportAction={exportSettingById.bind(null, settingId)}
              refreshAction={refreshSetting}
              bffDownloadPrefix="/api/setting/download"
            />
          }
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
          } as any}
        >
          <div
            className="space-y-6 px-4"
            data-page="setting-edit"
            data-setting-id={settingId}
          >
            <Setting
              settingId={settingId}
              settingData={settingDetail}
              createSettingAction={createSetting}
              updateSettingAction={updateSetting}
              patchSettingDraftAction={patchSettingDraft}
              decryptSettingKeyAction={decryptSetting}
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
            pathname={`/settings/${settingId}`}
          />
        );
      }
      if (error.status === 403) {
        return (
          <UnifiedAccessDenied
            reason="department"
            resourceType="setting"
            redirectPath="/settings"
          />
        );
      }
    }
    // Re-throw other errors
    throw error;
  }
}

// Types are now defined inline in components using InputOf/OutputOf
