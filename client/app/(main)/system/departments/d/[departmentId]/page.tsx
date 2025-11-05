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

// Import staff types and actions from staff page

import {
  bulkCreateOrUpdateStaff,
  getCreateStaffData,
  processCSV,
  searchStaff,
} from "@/app/(main)/management/staff/page";

/** ---- Strong types from OpenAPI ---- */
type DepartmentDetailIn = InputOf<"/api/v3/departments/detail", "post">;
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

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getDepartment = cache(
  async (input: DepartmentDetailIn): Promise<DepartmentDetailOut> => {
    return api.post("/departments/detail", input);
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

/** ---- Strongly-typed server actions ---- */
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

  // Fetch department detail (cached, won't duplicate with metadata)
  const departmentDetail = await getDepartment({
    body: { departmentId, profileId },
  });

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
    <div className="space-y-6">
      <Department
        departmentId={departmentId}
        departmentDetail={departmentDetail}
        updateDepartmentAction={updateDepartment}
        removeProfilesFromDepartmentAction={removeProfilesFromDepartment}
        processCSVAction={processCSV}
        bulkCreateOrUpdateStaffAction={bulkCreateOrUpdateStaff}
        searchStaffAction={searchStaff}
        initialSearchData={initialSearchData}
        initialCreateStaffData={initialCreateStaffData}
      />
    </div>
  );
}

/** ---- Derived types from server responses ---- */
export type DepartmentStaffItem = DepartmentDetailOut["staff"][number];

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DepartmentDetailIn,
  DepartmentDetailOut,
  DepartmentStaffItem,
  RemoveProfilesFromDepartmentIn,
  RemoveProfilesFromDepartmentOut,
  UpdateDepartmentIn,
  UpdateDepartmentOut,
};
