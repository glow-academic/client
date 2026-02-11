/**
 * app/(main)/settings/new/page.tsx
 * New settings page for the settings section.
 */

import Setting from "@/components/settings/Setting";
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

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getSettingDefault = async (
  input: GetSettingIn
): Promise<GetSettingOut> => {
  return api.post("/artifacts/settings/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

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

async function createProviderKeys(input: {
  provider_id: string;
  key_id: string;
}): Promise<{ provider_keys_id?: string | null }> {
  "use server";
  const result = await api.post("/resources/provider_keys" as any, {
    body: {
      provider_id: input.provider_id,
      key_id: input.key_id,
      mcp: false,
    },
  });
  return result as { provider_keys_id?: string | null };
}

async function getProviderKeys(
  ids: string[]
): Promise<
  Array<{
    id?: string | null;
    provider_id?: string | null;
    key_id?: string | null;
    provider_name?: string | null;
    key_name?: string | null;
    key_description?: string | null;
    generated?: boolean | null;
  }>
> {
  "use server";
  const result = await api.post("/resources/provider_keys/get" as any, {
    body: { ids },
  });
  return (result as { items?: unknown[] }).items as Array<{
    id?: string | null;
    provider_id?: string | null;
    key_id?: string | null;
    provider_name?: string | null;
    key_name?: string | null;
    key_description?: string | null;
    generated?: boolean | null;
  }>;
}

async function createAuthItemKeys(input: {
  auth_id: string;
  item_id: string;
  key_id: string;
}): Promise<{ auth_item_keys_id?: string | null }> {
  "use server";
  const result = await api.post("/resources/auth_item_keys" as any, {
    body: {
      auth_id: input.auth_id,
      item_id: input.item_id,
      key_id: input.key_id,
      mcp: false,
    },
  });
  return result as { auth_item_keys_id?: string | null };
}

async function getAuthItemKeys(
  ids: string[]
): Promise<
  Array<{
    id?: string | null;
    auth_id?: string | null;
    item_id?: string | null;
    key_id?: string | null;
    auth_name?: string | null;
    key_name?: string | null;
    key_description?: string | null;
    generated?: boolean | null;
  }>
> {
  "use server";
  const result = await api.post("/resources/auth_item_keys/get" as any, {
    body: { ids },
  });
  return (result as { items?: unknown[] }).items as Array<{
    id?: string | null;
    auth_id?: string | null;
    item_id?: string | null;
    key_id?: string | null;
    auth_name?: string | null;
    key_name?: string | null;
    key_description?: string | null;
    generated?: boolean | null;
  }>;
}


export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Settings",
    description:
      "Create new application settings configuration including authentication methods, providers, departments, and configuration options.",
  };
}

export default async function NewSettingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
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
  const settingDetailDefault = await getSettingDefault(input);

  return (
    <div
      className="space-y-6"
      data-page="setting-new"
      aria-label="Create new settings page"
    >
      <Setting
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        settingData={settingDetailDefault}
        saveSettingAction={saveSetting}
        patchSettingDraftAction={patchSettingDraft}
        createNamesAction={createDraftNames}
        createDescriptionsAction={createDraftDescriptions}
        createColorsAction={createDraftColors}
        createProviderKeysAction={createProviderKeys}
        getProviderKeysAction={getProviderKeys}
        createAuthKeysAction={createAuthItemKeys}
        getAuthKeysAction={getAuthItemKeys}
      />
    </div>
  );
}

// Types are now defined inline in components using InputOf/OutputOf
