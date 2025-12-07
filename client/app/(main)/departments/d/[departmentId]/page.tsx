/**
 * app/(main)/departments/d/[departmentId]/page.tsx
 * Department edit page
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { getSession } from "@/auth";

import { DepartmentAccessDenied } from "@/components/common/layout/DepartmentAccessDenied";
import Department from "@/components/departments/Department";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";

import { deleteDepartment } from "@/app/(main)/departments/page";

/** ---- Strong types from OpenAPI ---- */
type DepartmentDetailOut = OutputOf<"/api/v3/departments/detail", "post">;
type UpdateDepartmentIn = InputOf<"/api/v3/departments/update", "post">;
type UpdateDepartmentOut = OutputOf<"/api/v3/departments/update", "post">;

type CreateKeyIn = InputOf<"/api/v3/keys/create", "post">;
type CreateKeyOut = OutputOf<"/api/v3/keys/create", "post">;
type DecryptKeyIn = InputOf<"/api/v3/keys/decrypt-key", "post">;
type DecryptKeyOut = OutputOf<"/api/v3/keys/decrypt-key", "post">;
type UpdateKeyIn = InputOf<"/api/v3/keys/update", "post">;
type UpdateKeyOut = OutputOf<"/api/v3/keys/update", "post">;

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

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ departmentId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { departmentId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  try {
    const department = await getDepartment(departmentId, profileId);
    return {
      title: `${department?.title || "Department"} Department`,
      description: `${department?.title ? `${department.title} - ` : ""}Academic department for teaching assistant training programs.${department?.description ? ` ${department.description}` : ""} Manage department-specific settings and coordinate L&D programs across different academic units.`,
    };
  } catch {
    return {
      title: "Department",
      description: "Academic department for teaching assistant training programs. Manage department-specific settings and coordinate L&D programs across different academic units.",
    };
  }
}

/** ---- Strongly-typed server actions ---- */
async function updateDepartment(
  input: UpdateDepartmentIn,
): Promise<UpdateDepartmentOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/departments/update", input);
}

export async function createKey(input: CreateKeyIn): Promise<CreateKeyOut> {
  "use server";
  return api.post("/keys/create", input);
}

export async function decryptKey(input: DecryptKeyIn): Promise<DecryptKeyOut> {
  "use server";
  return api.post("/keys/decrypt-key", input);
}

export async function updateKey(input: UpdateKeyIn): Promise<UpdateKeyOut> {
  "use server";
  return api.post("/keys/update", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function DepartmentEditPage({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}) {
  const { departmentId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch department detail (always fresh - source of truth)
  try {
    const departmentDetail = await getDepartment(departmentId, profileId);

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
          deleteDepartmentAction={deleteDepartment}
          createKeyAction={createKey}
          decryptKeyAction={decryptKey}
          updateKeyAction={updateKey}
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
        <DepartmentAccessDenied
          resourceType="department"
          redirectPath="/departments"
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
  UpdateDepartmentIn,
  UpdateDepartmentOut,
  UpdateKeyIn,
  UpdateKeyOut,
};
