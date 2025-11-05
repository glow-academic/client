/**
 * app/(main)/system/departments/d/[departmentId]/page.tsx
 * Department edit page
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { auth } from "@/auth";
import Department from "@/components/departments/Department";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type DepartmentDetailIn = InputOf<"/api/v3/departments/detail", "post">;
type DepartmentDetailOut = OutputOf<"/api/v3/departments/detail", "post">;

type DepartmentDetailDefaultIn = InputOf<
  "/api/v3/departments/detail-default",
  "post"
>;
type DepartmentDetailDefaultOut = OutputOf<
  "/api/v3/departments/detail-default",
  "post"
>;

type CreateDepartmentIn = InputOf<"/api/v3/departments/create", "post">;
type CreateDepartmentOut = OutputOf<"/api/v3/departments/create", "post">;

type UpdateDepartmentIn = InputOf<"/api/v3/departments/update", "post">;
type UpdateDepartmentOut = OutputOf<"/api/v3/departments/update", "post">;

type RemoveProfilesFromDepartmentIn = InputOf<
  "/api/v3/departments/remove-profiles",
  "post"
>;
type RemoveProfilesFromDepartmentOut = OutputOf<
  "/api/v3/departments/remove-profiles",
  "post"
>;

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getDepartment = cache(
  async (input: DepartmentDetailIn): Promise<DepartmentDetailOut> => {
    return api.post("/departments/detail", input);
  }
);

const getDepartmentDefault = cache(
  async (
    input: DepartmentDetailDefaultIn
  ): Promise<DepartmentDetailDefaultOut> => {
    return api.post("/departments/detail-default", input);
  }
);

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ departmentId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { departmentId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  try {
    const department = await getDepartment({
      body: { departmentId, profileId },
    });
    return {
      title: `${department?.title || "Department"} Department`,
      description: `${department ? `${department.title} ${department.description || ""}` : "Department"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Department",
      description: `Department in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function createDepartment(
  input: CreateDepartmentIn
): Promise<CreateDepartmentOut> {
  "use server";
  const out = await api.post("/departments/create", input);
  revalidateTag("departments");
  return out;
}

export async function updateDepartment(
  input: UpdateDepartmentIn
): Promise<UpdateDepartmentOut> {
  "use server";
  const out = await api.post("/departments/update", input);
  revalidateTag("departments");
  return out;
}

export async function removeProfilesFromDepartment(
  input: RemoveProfilesFromDepartmentIn
): Promise<RemoveProfilesFromDepartmentOut> {
  "use server";
  const out = await api.post("/departments/remove-profiles", input);
  revalidateTag("departments");
  return out;
}

/** ---- Server renders client with typed data and actions ---- */
export default async function DepartmentEditPage({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}) {
  const { departmentId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  // Fetch data based on mode (edit vs create)
  const [departmentDetail, departmentDetailDefault] = await Promise.all([
    departmentId
      ? getDepartment({ body: { departmentId, profileId } }).catch(() => null)
      : Promise.resolve(null),
    !departmentId
      ? getDepartmentDefault({ body: { profileId } }).catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <Department
        departmentId={departmentId}
        departmentDetail={departmentDetail || undefined}
        departmentDetailDefault={departmentDetailDefault || undefined}
        createDepartmentAction={createDepartment}
        updateDepartmentAction={updateDepartment}
        removeProfilesFromDepartmentAction={removeProfilesFromDepartment}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateDepartmentIn,
  CreateDepartmentOut,
  DepartmentDetailDefaultIn,
  DepartmentDetailDefaultOut,
  DepartmentDetailIn,
  DepartmentDetailOut,
  RemoveProfilesFromDepartmentIn,
  RemoveProfilesFromDepartmentOut,
  UpdateDepartmentIn,
  UpdateDepartmentOut,
};
