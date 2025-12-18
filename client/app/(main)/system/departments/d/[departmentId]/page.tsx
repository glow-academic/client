/**
 * app/(main)/system/departments/d/[departmentId]/page.tsx
 * Department edit page
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Department from "@/components/departments/Department";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";

import { deleteDepartment } from "@/app/(main)/system/departments/page";

/** ---- Strong types from OpenAPI ---- */
type DepartmentDetailOut = OutputOf<"/api/v3/departments/detail", "post">;
type UpdateDepartmentIn = InputOf<"/api/v3/departments/update", "post">;
type UpdateDepartmentOut = OutputOf<"/api/v3/departments/update", "post">;

type CreateKeyIn = InputOf<"/api/v3/keys/create", "post">;
type CreateKeyOut = OutputOf<"/api/v3/keys/create", "post">;
type DecryptKeyIn = InputOf<"/api/v3/keys/decrypt", "post">;
type DecryptKeyOut = OutputOf<"/api/v3/keys/decrypt", "post">;
type UpdateKeyIn = InputOf<"/api/v3/keys/update", "post">;
type UpdateKeyOut = OutputOf<"/api/v3/keys/update", "post">;
type KeysListOut = OutputOf<"/api/v3/keys/list", "post">;
type SettingsDetailOut = OutputOf<"/api/v3/settings/detail", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getDepartment = async (
  departmentId: string,
  profileId: string,
): Promise<DepartmentDetailOut> => {
  return api.post(
    "/departments/detail",
    { body: { departmentId, profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

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

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ departmentId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { departmentId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (profileId) {
    try {
      const department = await getDepartment(departmentId, profileId);
      return {
        title: `${department?.title || "Department"} Department`,
        description: `${department?.title ? `${department.title} - ` : ""}Academic department for teaching assistant training programs.${department?.description ? ` ${department.description}` : ""} Manage department-specific settings and coordinate L&D programs across different academic units.`,
      };
    } catch {
      // Fall through to default metadata
    }
  }

  return {
    title: "Department",
    description:
      "Academic department for teaching assistant training programs. Manage department-specific settings and coordinate L&D programs across different academic units.",
  };
}

/** ---- Strongly-typed server actions ---- */
async function updateDepartment(
  input: UpdateDepartmentIn,
): Promise<UpdateDepartmentOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/departments/update", input);
}

async function createKey(input: CreateKeyIn): Promise<CreateKeyOut> {
  "use server";
  return api.post("/keys/create", input);
}

async function decryptKey(input: DecryptKeyIn): Promise<DecryptKeyOut> {
  "use server";
  return api.post("/keys/decrypt-key", input);
}

async function updateKey(input: UpdateKeyIn): Promise<UpdateKeyOut> {
  "use server";
  return api.post("/keys/update", input);
}

async function getKeysListAction(profileId: string): Promise<KeysListOut> {
  "use server";
  return getKeysList(profileId);
}

async function getSettingsDetailAction(
  settingsId: string,
  profileId: string,
): Promise<SettingsDetailOut> {
  "use server";
  return getSettingsDetail(settingsId, profileId);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function DepartmentEditPage({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}) {
  const { departmentId } = await params;

  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  // Fetch department detail (always fresh - source of truth)
  try {
    const departmentDetail = await getDepartment(departmentId, profileId);

    // Fetch keys list
    const keysList = await getKeysList(profileId);

    // Fetch settings detail if department has linked settings
    let settingsDetail: SettingsDetailOut | null = null;
    if (departmentDetail.settings_id) {
      try {
        settingsDetail = await getSettingsDetail(
          departmentDetail.settings_id,
          profileId,
        );
      } catch {
        // Settings might not exist, continue without it
      }
    }

    return (
      <div
        className="space-y-6"
        data-page="department-edit"
        data-department-id={departmentId}
      >
        <Department
          departmentId={departmentId}
          departmentDetail={departmentDetail}
          keysList={keysList}
          settingsDetail={settingsDetail}
          updateDepartmentAction={updateDepartment}
          deleteDepartmentAction={deleteDepartment}
          createKeyAction={createKey}
          decryptKeyAction={decryptKey}
          updateKeyAction={updateKey}
          getKeysListAction={getKeysListAction}
          getSettingsDetailAction={getSettingsDetailAction}
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
          resourceType="department"
          redirectPath="/system/departments"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateKeyIn,
  CreateKeyOut,
  DecryptKeyIn,
  DecryptKeyOut,
  DepartmentDetailOut,
  KeysListOut,
  SettingsDetailOut,
  UpdateDepartmentIn,
  UpdateDepartmentOut,
  UpdateKeyIn,
  UpdateKeyOut,
};
