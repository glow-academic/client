/**
 * app/(main)/management/departments/d/[departmentId]/page.tsx
 * Department edit page
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { getSession } from "@/auth";

import Department from "@/components/departments/Department";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidateTag, unstable_cache } from "next/cache";

// Import staff types and actions from staff page

import {
  bulkCreateOrUpdateStaff,
  getCreateStaffData,
  processCSV,
  searchStaff,
  updateStaff,
} from "@/app/(main)/system/staff/page";
import {
  deleteDepartment,
  duplicateDepartment,
} from "@/app/(main)/management/departments/page";

/** ---- Strong types from OpenAPI ---- */
type DepartmentDetailOut = OutputOf<"/api/v3/departments/detail", "post">;
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

/** ---- Cached fetch used by both page + metadata (prevents double hit) ----
 * Cache key includes departmentId and profileId so entries are per-user per-department.
 * Tags allow revalidateTag("departments") and revalidateTag(`department:${departmentId}`) to invalidate.
 */
const getDepartment = (departmentId: string) =>
  unstable_cache(
    async (profileId: string): Promise<DepartmentDetailOut> => {
      return api.post("/departments/detail", {
        body: { departmentId, profileId },
      });
    },
    ["departments:detail", departmentId],
    { tags: ["departments", `department:${departmentId}`] }
  );

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ departmentId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { departmentId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  try {
    const department = await getDepartment(departmentId)(profileId);
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

/** ---- Strongly-typed server actions ---- */
export async function updateDepartment(
  input: UpdateDepartmentIn,
): Promise<UpdateDepartmentOut> {
  "use server";
  const out = await api.post("/departments/update", input);
  revalidateTag("departments");
  const departmentId = input.body?.departmentId;
  if (departmentId) {
    revalidateTag(`department:${departmentId}`);
  }
  return out;
}

export async function removeProfilesFromDepartment(
  input: RemoveProfilesFromDepartmentIn,
): Promise<RemoveProfilesFromDepartmentOut> {
  "use server";
  const out = await api.post("/departments/remove-profiles", input);
  revalidateTag("departments");
  const departmentId = input.body?.departmentId;
  if (departmentId) {
    revalidateTag(`department:${departmentId}`);
  }
  return out;
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

  // Fetch department detail (cached, won't duplicate with metadata)
  const departmentDetail = await getDepartment(departmentId)(profileId);

  // Fetch initial search data (empty query) for SearchExistingStaffModal
  const initialSearchData = await searchStaff({
    body: {
      query: null,
      cohortIds: null,
      departmentIds: [departmentId],
      limit: 200,
      profileId,
    },
  });

  // Fetch initial create staff data for CreateStaffButton
  const initialCreateStaffData = await getCreateStaffData({
    body: {
      departmentIds: [departmentId],
      profileId,
    },
  });

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
        removeProfilesFromDepartmentAction={removeProfilesFromDepartment}
        duplicateDepartmentAction={duplicateDepartment}
        deleteDepartmentAction={deleteDepartment}
        processCSVAction={processCSV}
        bulkCreateOrUpdateStaffAction={bulkCreateOrUpdateStaff}
        searchStaffAction={searchStaff}
        initialSearchData={initialSearchData}
        initialCreateStaffData={initialCreateStaffData}
        updateStaffAction={updateStaff}
      />
    </div>
  );
}

/** ---- Derived types from server responses ---- */
type DepartmentStaffItem = DepartmentDetailOut["staff"][number];

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DepartmentDetailOut,
  DepartmentStaffItem,
  RemoveProfilesFromDepartmentIn,
  RemoveProfilesFromDepartmentOut,
  UpdateDepartmentIn,
  UpdateDepartmentOut,
};
