/**
 * app/(main)/settings/[settingId]/page.tsx
 * Settings edit page for the settings page.
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Setting from "@/components/artifacts/setting/Setting";
import { resolveGroupId } from "@/app/(main)/layout-server";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetSettingIn = InputOf<"/api/v4/artifacts/settings/get", "post">;
type GetSettingOut = OutputOf<"/api/v4/artifacts/settings/get", "post">;
type SaveSettingIn = InputOf<"/api/v4/artifacts/settings/save", "post">;
type SaveSettingOut = OutputOf<"/api/v4/artifacts/settings/save", "post">;
type PatchSettingDraftIn = InputOf<"/api/v4/artifacts/settings/draft", "patch">;
type PatchSettingDraftOut = OutputOf<"/api/v4/artifacts/settings/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftColorsIn = InputOf<"/api/v4/resources/colors", "post">;
type CreateDraftColorsOut = OutputOf<"/api/v4/resources/colors", "post">;
type CreateProviderKeysIn = InputOf<"/api/v4/resources/provider_keys", "post">;
type CreateProviderKeysOut = OutputOf<
  "/api/v4/resources/provider_keys",
  "post"
>;
type GetProviderKeysIn = InputOf<
  "/api/v4/resources/provider_keys/get",
  "post"
>;
type GetProviderKeysOut = OutputOf<
  "/api/v4/resources/provider_keys/get",
  "post"
>;
type CreateAuthItemKeysIn = InputOf<
  "/api/v4/resources/auth_item_keys",
  "post"
>;
type CreateAuthItemKeysOut = OutputOf<
  "/api/v4/resources/auth_item_keys",
  "post"
>;
type GetAuthItemKeysIn = InputOf<
  "/api/v4/resources/auth_item_keys/get",
  "post"
>;
type GetAuthItemKeysOut = OutputOf<
  "/api/v4/resources/auth_item_keys/get",
  "post"
>;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getSetting = async (input: GetSettingIn): Promise<GetSettingOut> => {
  return api.post("/artifacts/settings/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/settings/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/settings/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/settings/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ settingId: string }>;
}): Promise<Metadata> {
  const { settingId } = await params;
  const docs = await getDocs({ body: { entity_id: settingId } });
  return { title: docs.detail.title, description: docs.detail.description };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function saveSetting(input: SaveSettingIn): Promise<SaveSettingOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/settings/save", input);
}

async function patchSettingDraft(
  input: PatchSettingDraftIn
): Promise<PatchSettingDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/artifacts/settings/draft", input);
}

async function createDraftNames(
  input: CreateDraftNamesIn
): Promise<CreateDraftNamesOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/names", input);
}

async function createDraftDescriptions(
  input: CreateDraftDescriptionsIn
): Promise<CreateDraftDescriptionsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/descriptions", input);
}

async function createDraftColors(
  input: CreateDraftColorsIn
): Promise<CreateDraftColorsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/colors", input);
}

async function createProviderKeys(
  input: CreateProviderKeysIn
): Promise<CreateProviderKeysOut> {
  "use server";
  return api.post("/resources/provider_keys", input);
}

async function getProviderKeys(
  input: GetProviderKeysIn
): Promise<GetProviderKeysOut> {
  "use server";
  return api.post("/resources/provider_keys/get", input);
}

async function createAuthItemKeys(
  input: CreateAuthItemKeysIn
): Promise<CreateAuthItemKeysOut> {
  "use server";
  return api.post("/resources/auth_item_keys", input);
}

async function getAuthItemKeys(
  input: GetAuthItemKeysIn
): Promise<GetAuthItemKeysOut> {
  "use server";
  return api.post("/resources/auth_item_keys/get", input);
}


/** ---- Server renders client with typed data and actions ---- */
export default async function SettingEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ settingId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { settingId } = await params;
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
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

  // Resolve group_id from layout context (cached per request)
  const groupId = (await resolveGroupId({ draft_id: q.draftId ?? null, artifact_type: "setting" })).group_id;

  // Fetch setting detail (always fresh - source of truth) with filter params
  try {
    const input: GetSettingIn = {
      body: {
        settings_id: settingId,
        draft_id: q.draftId ?? null,
        group_id: groupId,
        color_search: q.colorSearch ?? null,
      } as GetSettingIn["body"],
    };
    const settingDetail = await getSetting(input);

    return (
      <div
        className="space-y-6"
        data-page="setting-edit"
        data-setting-id={settingId}
      >
        <Setting
          settingId={settingId}
          settingData={settingDetail}
          saveSettingAction={saveSetting}
          patchSettingDraftAction={patchSettingDraft}
          createNamesAction={createDraftNames}
          createDescriptionsAction={createDraftDescriptions}
          createColorsAction={createDraftColors}
          createProviderKeysAction={async (input) => {
            "use server";
            return createProviderKeys({ body: { ...input, mcp: false } });
          }}
          getProviderKeysAction={async (ids) => {
            "use server";
            const result = await getProviderKeys({ body: { ids } });
            return result.items ?? [];
          }}
          createAuthItemKeysAction={async (input) => {
            "use server";
            return createAuthItemKeys({ body: { ...input, mcp: false } });
          }}
          getAuthItemKeysAction={async (ids) => {
            "use server";
            const result = await getAuthItemKeys({ body: { ids } });
            return result.items ?? [];
          }}
        />
      </div>
    );
  } catch (error: unknown) {
    // Check if it's a 403 error (department access denied)
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 403
    ) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="setting"
          redirectPath="/settings"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

// Types are now defined inline in components using InputOf/OutputOf
