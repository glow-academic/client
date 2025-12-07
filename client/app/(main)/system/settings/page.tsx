/**
 * app/(main)/system/settings/page.tsx
 * Settings page
 */

import { getSession } from "@/auth";
import Settings from "@/components/settings/Settings";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";

/** ---- Strong types from OpenAPI ---- */
type SettingsListIn = InputOf<"/api/v3/settings/list", "post">;
type SettingsListOut = OutputOf<"/api/v3/settings/list", "post">;
type SettingsDetailIn = InputOf<"/api/v3/settings/detail", "post">;
type SettingsDetailOut = OutputOf<"/api/v3/settings/detail", "post">;
type UpdateSettingsIn = InputOf<"/api/v3/settings/update", "post">;
type UpdateSettingsOut = OutputOf<"/api/v3/settings/update", "post">;
type KeysListOut = OutputOf<"/api/v3/keys/list", "post">;

/** ---- Direct fetch for settings list ---- */
const getSettingsList = async (profileId: string): Promise<SettingsListOut> => {
  return api.post(
    "/settings/list",
    { body: { profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Direct fetch for settings detail ---- */
const getSettingsDetail = async (
  settingsId: string,
  profileId: string,
): Promise<SettingsDetailOut> => {
  return api.post(
    "/settings/detail",
    { body: { settingsId, profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Direct fetch for keys list ---- */
const getKeysList = async (profileId: string): Promise<KeysListOut> => {
  return api.post(
    "/keys/list",
    { body: { profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updateSettings(
  input: UpdateSettingsIn,
): Promise<UpdateSettingsOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  return api.post("/settings/update", {
    ...input,
    body: { ...input.body, profileId },
  });
}

async function getSettingsDetailAction(
  settingsId: string,
  profileId: string,
): Promise<SettingsDetailOut> {
  "use server";
  return getSettingsDetail(settingsId, profileId);
}

async function getKeysListAction(profileId: string): Promise<KeysListOut> {
  "use server";
  return getKeysList(profileId);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function SettingsPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch settings list
  const listResult = await getSettingsList(profileId);

  // Find active settings or use first one
  const activeSettings = listResult.settings.find((s) => s.active);
  const defaultSettings = activeSettings || listResult.settings[0] || null;

  // Fetch detail for default settings
  let settingsDetail: SettingsDetailOut | null = null;
  let selectedSettingsId: string | null = null;

  if (defaultSettings) {
    selectedSettingsId = defaultSettings.settings_id;
    settingsDetail = await getSettingsDetail(
      defaultSettings.settings_id,
      profileId,
    );
  }

  // Fetch keys list
  const keysList = await getKeysList(profileId);

  return (
    <div className="space-y-6" data-page="settings-index">
      <Settings
        settingsList={listResult.settings}
        settingsDetail={settingsDetail}
        selectedSettingsId={selectedSettingsId}
        profileId={profileId}
        keysList={keysList}
        getSettingsDetailAction={getSettingsDetailAction}
        getKeysListAction={getKeysListAction}
        updateSettingsAction={updateSettings}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  SettingsDetailIn,
  SettingsDetailOut,
  SettingsListIn,
  SettingsListOut,
  UpdateSettingsIn,
  UpdateSettingsOut,
  KeysListOut,
};
