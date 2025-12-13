/**
 * app/(main)/settings/page.tsx
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
type StaffListIn = InputOf<"/api/v3/profile/staff/list", "post">;
type StaffListOut = OutputOf<"/api/v3/profile/staff/list", "post">;

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

/** ---- Direct fetch for staff list (for profile selection) ---- */
const getStaffList = async (profileId: string): Promise<StaffListOut> => {
  return api.post(
    "/profile/staff/list",
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

async function getStaffListAction(profileId: string): Promise<StaffListOut> {
  "use server";
  return getStaffList(profileId);
}

export default async function SettingsPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch settings list server-side
  const settingsList = await getSettingsList(profileId);
  const keysList = await getKeysList(profileId);
  const staffList = await getStaffListAction({
    body: { profileId },
  });

  return (
    <div className="space-y-6" data-page="settings-index">
      <Settings
        settingsList={settingsList}
        keysList={keysList}
        staffList={staffList}
        getSettingsDetailAction={getSettingsDetail}
        updateSettingsAction={updateSettings}
        getKeysListAction={getKeysListAction}
        getStaffListAction={getStaffListAction}
      />
    </div>
  );
}

