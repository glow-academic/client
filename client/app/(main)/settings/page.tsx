/**
 * app/(main)/settings/page.tsx
 * Settings page
 */

import Settings from "@/components/settings/Settings";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";

/** ---- Strong types from OpenAPI ---- */
export type SettingsListOut = OutputOf<"/api/v4/settings/list", "post">;
export type SettingsDetailOut = OutputOf<"/api/v4/settings/detail", "post">;
export type UpdateSettingsIn = InputOf<"/api/v4/settings/update", "post">;
export type UpdateSettingsOut = OutputOf<"/api/v4/settings/update", "post">;
export type PatchSettingsDraftIn = InputOf<"/api/v4/settings/draft", "patch">;
export type PatchSettingsDraftOut = OutputOf<"/api/v4/settings/draft", "patch">;
export type KeysListOut = OutputOf<"/api/v4/keys/list", "post">;
export type StaffListOut = OutputOf<"/api/v4/staff/list", "post">;
export type DepartmentsListOut = OutputOf<"/api/v4/departments/list", "post">;

/** ---- Direct fetch for settings list ---- */
const getSettingsList = async (): Promise<SettingsListOut> => {
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post(
    "/settings/list",
    { body: {} },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Direct fetch for settings detail ---- */
const getSettingsDetail = async (
  settingsId: string,
  draftId?: string | null
): Promise<SettingsDetailOut> => {
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Convert camelCase to snake_case for API
  return api.post(
    "/settings/detail",
    {
      body: {
        settings_id: settingsId,
        draft_id: draftId || null,
      },
    },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Direct fetch for keys list ---- */
const getKeysList = async (): Promise<KeysListOut> => {
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post(
    "/keys/list",
    { body: {} },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Direct fetch for staff list (for profile selection) ---- */
const getStaffList = async (): Promise<StaffListOut> => {
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post(
    "/staff/list",
    { body: {} },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Direct fetch for departments list (for department picker) ---- */
const getDepartmentsList = async (): Promise<DepartmentsListOut> => {
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post(
    "/departments/list",
    { body: {} },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updateSettings(
  input: UpdateSettingsIn
): Promise<UpdateSettingsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/settings/update", input);
}

async function patchSettingsDraft(
  input: PatchSettingsDraftIn
): Promise<PatchSettingsDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/settings/draft", input);
}

async function getSettingsDetailAction(
  settingsId: string,
  draftId?: string | null
): Promise<SettingsDetailOut> {
  "use server";
  return getSettingsDetail(settingsId, draftId);
}

async function getKeysListAction(): Promise<KeysListOut> {
  "use server";
  return getKeysList();
}

async function getStaffListAction(): Promise<StaffListOut> {
  "use server";
  return getStaffList();
}

export default async function SettingsPage() {
  // Access control is handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)

  // Fetch settings list server-side
  const settingsListResponse = await getSettingsList();
  const keysList = await getKeysList();
  const staffList = await getStaffListAction();
  const departmentsList = await getDepartmentsList();

  return (
    <div className="space-y-6" data-page="settings-index">
      <Settings
        settingsList={settingsListResponse.settings}
        settingsDetail={null}
        selectedSettingsId={null}
        keysList={keysList}
        staffList={staffList}
        departmentsList={departmentsList}
        getSettingsDetailAction={getSettingsDetailAction}
        updateSettingsAction={updateSettings}
        patchSettingsDraftAction={patchSettingsDraft}
        getKeysListAction={getKeysListAction}
        getStaffListAction={getStaffListAction}
      />
    </div>
  );
}
