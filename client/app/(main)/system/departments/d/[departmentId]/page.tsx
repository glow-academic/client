/**
 * app/(main)/system/departments/d/[departmentId]/page.tsx
 * Department edit page
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Department from "@/components/departments/Department";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type DepartmentDetailOut = OutputOf<"/api/v4/departments/detail", "post">;
type UpdateDepartmentIn = InputOf<"/api/v4/departments/update", "post">;
type UpdateDepartmentOut = OutputOf<"/api/v4/departments/update", "post">;

type CreateKeyIn = InputOf<"/api/v4/keys/create", "post">;
type CreateKeyOut = OutputOf<"/api/v4/keys/create", "post">;
type DecryptKeyIn = InputOf<"/api/v4/keys/decrypt", "post">;
type DecryptKeyOut = OutputOf<"/api/v4/keys/decrypt", "post">;
type UpdateKeyIn = InputOf<"/api/v4/keys/update", "post">;
type UpdateKeyOut = OutputOf<"/api/v4/keys/update", "post">;
type KeysListOut = OutputOf<"/api/v4/keys/list", "post">;
type SettingsDetailOut = OutputOf<"/api/v4/settings/detail", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getDepartment = async (
  departmentId: string
): Promise<DepartmentDetailOut> => {
  return api.post(
    "/departments/detail",
    { body: { department_id: departmentId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ departmentId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { departmentId } = await params;
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const department = await getDepartment(departmentId);
    return {
      title: `${department?.title || "Department"} Department`,
      description: `${department?.title ? `${department.title} - ` : ""}Academic department for teaching assistant training programs.${department?.description ? ` ${department.description}` : ""} Manage department-specific settings and coordinate L&D programs across different academic units.`,
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Department",
    description:
      "Academic department for teaching assistant training programs. Manage department-specific settings and coordinate L&D programs across different academic units.",
  };
}

/** ---- Strongly-typed server actions ---- */
async function updateDepartment(
  input: UpdateDepartmentIn
): Promise<UpdateDepartmentOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/departments/update", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function DepartmentEditPage({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}) {
  const { departmentId } = await params;

  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch department detail (always fresh - source of truth)
  try {
    const departmentDetail = await getDepartment(departmentId);

    return (
      <div
        className="space-y-6"
        data-page="department-edit"
        data-department-id={departmentId}
      >
        <Department
          departmentId={departmentId}
          departmentDetail={departmentDetail}
          updateDepartmentAction={updateDepartment}
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
