/**
 * app/(main)/settings/[settingId]/page.tsx
 * Setting edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Setting from "@/components/artifacts/setting/Setting";
import { DraftProviderClient } from "@/contexts/draft-context";

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
type UpdateSettingIn = InputOf<"/setting/update", "post">;
type UpdateSettingOut = OutputOf<"/setting/update", "post">;
type PatchSettingDraftIn = InputOf<"/setting/draft", "patch">;
type PatchSettingDraftOut = OutputOf<"/setting/draft", "patch">;
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
  return api.patch("/setting/draft", input);
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
export async function generateMetadata({
  params,
}: {
  params: Promise<{ settingId: string }>;
}): Promise<Metadata> {
  try {
    const { settingId } = await params;
    const context = await api.post("/setting/context", { body: { entity_id: settingId } } as ContextIn) as ContextOut;
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
  };
  const loadSettingSearchParams = createLoader(settingSearchParams);
  const q = loadSettingSearchParams(searchParamsObj);

  // Fetch setting detail (always fresh - source of truth) with filter params
  try {
    const input: GetSettingIn = {
      body: {
        settings_id: settingId,
        draft_id: q.draftId ?? null,
        color_search: q.colorSearch ?? null,
      } as GetSettingIn["body"],
    };
    const [settingDetail, context, draftsResult, groupResult] = await Promise.all([
      getSetting(input),
      api.post("/setting/context", { body: { entity_id: settingId } } as ContextIn) as Promise<ContextOut>,
      api.post("/setting/drafts", {}),
      api.post("/setting/group", { body: {} } as GroupSettingIn),
    ]);

    const entityName = context.page_metadata?.detail.title;

    return (
      <DraftProviderClient drafts={draftsResult.entries ?? []}>
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
            { title: "Settings", section: "settings", url: "/setting" },
            { title: entityName },
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
          }}
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
  } catch (error: unknown) {
    // Check if it's a 403 error (department access denied)
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error.status === 401 || error.status === 403)
    ) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="setting"
          redirectPath="/setting"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

// Types are now defined inline in components using InputOf/OutputOf
