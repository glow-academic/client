/**
 * app/(main)/settings/new/page.tsx
 * New setting page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Setting from "@/components/artifacts/setting/Setting";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsString } from "nuqs/server";

import { getLayoutContextData } from "@/app/(main)/layout-server";

/** ---- Strong types from OpenAPI ---- */
type GetSettingIn = InputOf<"/settings/get", "post">;
type GetSettingOut = OutputOf<"/settings/get", "post">;
type CreateSettingIn = InputOf<"/settings/create", "post">;
type CreateSettingOut = OutputOf<"/settings/create", "post">;
type PatchSettingDraftIn = InputOf<"/settings/draft", "patch">;
type PatchSettingDraftOut = OutputOf<"/settings/draft", "patch">;
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
type CreateDraftColorsIn = InputOf<"/api/v5/resources/colors", "post">;
type CreateDraftColorsOut = OutputOf<"/api/v5/resources/colors", "post">;
type CreateProviderKeysIn = InputOf<"/api/v5/resources/provider_keys", "post">;
type CreateProviderKeysOut = OutputOf<
  "/api/v5/resources/provider_keys",
  "post"
>;
type CreateAuthItemKeysIn = InputOf<
  "/api/v5/resources/auth_item_keys",
  "post"
>;
type CreateAuthItemKeysOut = OutputOf<
  "/api/v5/resources/auth_item_keys",
  "post"
>;
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

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getSettingDefault = async (
  input: GetSettingIn
): Promise<GetSettingOut> => {
  return api.post("/settings/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createSetting(input: CreateSettingIn): Promise<CreateSettingOut> {
  "use server";
  return api.post("/settings/create", input);
}

async function patchSettingDraft(
  input: PatchSettingDraftIn
): Promise<PatchSettingDraftOut> {
  "use server";
  return api.patch("/settings/draft", input);
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

async function createDraftColors(
  input: CreateDraftColorsIn
): Promise<CreateDraftColorsOut> {
  "use server";
  return api.post("/resources/colors", input);
}

async function createProviderKeys(
  input: CreateProviderKeysIn
): Promise<CreateProviderKeysOut> {
  "use server";
  return api.post("/resources/provider_keys", input);
}

async function createAuthItemKeys(
  input: CreateAuthItemKeysIn
): Promise<CreateAuthItemKeysOut> {
  "use server";
  return api.post("/resources/auth_item_keys", input);
}

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
    title: context.page_metadata?.new.title,
    description: context.page_metadata?.new.description,
  };
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

  // Profile data for providers
  const { profileData, snapshot } = await getLayoutContextData(session);

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
  const input: GetSettingIn = {
    body: {
      settings_id: null, // NULL for new mode
      draft_id: q.draftId ?? null,
      color_search: q.colorSearch ?? null,
    } as GetSettingIn["body"],
  };
  const [settingDetailDefault, draftsResult, groupResult] = await Promise.all([
    getSettingDefault(input),
    api.post("/settings/drafts", {}),
    api.post("/settings/group", { body: {} } as GroupSettingIn),
  ]);

  return (
    <DraftProviderClient drafts={draftsResult.entries ?? []}>
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
          { title: "Settings", section: "settings", url: "/settings" },
          { title: "New Setting" },
        ]}
        toolbar={<SaveToolbar />}
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
            createNamesAction={createDraftNames}
            createDescriptionsAction={createDraftDescriptions}
            createColorsAction={createDraftColors}
            createProviderKeysAction={async (input) => {
              "use server";
              return createProviderKeys({ body: { ...input, mcp: false } });
            }}
            createAuthItemKeysAction={async (input) => {
              "use server";
              return createAuthItemKeys({ body: { ...input, mcp: false } });
            }}
          />
        </div>
      </FullPageLayout>
    </DraftProviderClient>
  );
}

// Types are now defined inline in components using InputOf/OutputOf
