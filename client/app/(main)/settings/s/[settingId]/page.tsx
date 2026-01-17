/**
 * app/(main)/settings/s/[settingId]/page.tsx
 * Settings edit page for the settings page.
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Setting from "@/components/settings/Setting";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetSettingIn = InputOf<"/api/v4/settings/get", "post">;
type GetSettingOut = OutputOf<"/api/v4/settings/get", "post">;
type SaveSettingIn = InputOf<"/api/v4/settings/save", "post">;
type SaveSettingOut = OutputOf<"/api/v4/settings/save", "post">;
type PatchSettingDraftIn = InputOf<"/api/v4/settings/draft", "patch">;
type PatchSettingDraftOut = OutputOf<"/api/v4/settings/draft", "patch">;
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
type CreateDraftFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;
type CreateDraftDepartmentsIn = InputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftDepartmentsOut = OutputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftAuthsIn = InputOf<"/api/v4/resources/auths", "post">;
type CreateDraftAuthsOut = OutputOf<"/api/v4/resources/auths", "post">;
type CreateDraftProvidersIn = InputOf<
  "/api/v4/resources/providers",
  "post"
>;
type CreateDraftProvidersOut = OutputOf<
  "/api/v4/resources/providers",
  "post"
>;
type CreateDraftKeysIn = InputOf<"/api/v4/resources/keys", "post">;
type CreateDraftKeysOut = OutputOf<"/api/v4/resources/keys", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getSetting = async (input: GetSettingIn): Promise<GetSettingOut> => {
  return api.post("/settings/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ settingId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { settingId } = await params;
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const input: GetSettingIn = {
      body: {
        settings_id: settingId,
        color_search: null,
      } as GetSettingIn["body"],
    };
    const setting = await getSetting(input);
    return {
      title: `${setting?.name_resource?.name || "Setting"} Settings`,
      description: `${setting?.name_resource?.name ? `${setting.name_resource.name} - ` : ""}Application settings configuration.${setting?.description_resource?.description ? ` ${setting.description_resource.description}` : ""}`,
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Settings",
    description: "Application settings configuration.",
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function saveSetting(input: SaveSettingIn): Promise<SaveSettingOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/settings/save", input);
}

async function patchSettingDraft(
  input: PatchSettingDraftIn
): Promise<PatchSettingDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/settings/draft", input);
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

async function createDraftFlags(
  input: CreateDraftFlagsIn
): Promise<CreateDraftFlagsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/flags", input);
}

async function createDraftDepartments(
  input: CreateDraftDepartmentsIn
): Promise<CreateDraftDepartmentsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/departments", input);
}

async function createDraftAuths(
  input: CreateDraftAuthsIn
): Promise<CreateDraftAuthsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/auths", input);
}

async function createDraftProviders(
  input: CreateDraftProvidersIn
): Promise<CreateDraftProvidersOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/providers", input);
}

async function createDraftKeys(
  input: CreateDraftKeysIn
): Promise<CreateDraftKeysOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/keys", input);
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

  // Fetch setting detail (always fresh - source of truth) with filter params
  try {
    const input: GetSettingIn = {
      body: {
        settings_id: settingId,
        draft_id: q.draftId ?? null,
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
          createFlagsAction={createDraftFlags}
          createDepartmentsAction={createDraftDepartments}
          createAuthsAction={createDraftAuths}
          createProvidersAction={createDraftProviders}
          createKeysAction={createDraftKeys}
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
