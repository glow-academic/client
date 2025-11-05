/**
 * app/(main)/system/departments/new/page.tsx
 * New department page for the departments section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { auth } from "@/auth";
import Department from "@/components/departments/Department";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

// Import staff actions from staff page
import {
  bulkCreateOrUpdateStaff,
  getCreateStaffData,
  processCSV,
  searchStaff,
} from "@/app/(main)/management/staff/page";

/** ---- Strong types from OpenAPI ---- */
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


/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getDepartmentDefault = cache(
  async (
    input: DepartmentDetailDefaultIn
  ): Promise<DepartmentDetailDefaultOut> => {
    return api.post("/departments/detail-default", input);
  }
);

/** ---- Strongly-typed server action ---- */
export async function createDepartment(
  input: CreateDepartmentIn
): Promise<CreateDepartmentOut> {
  "use server";
  const out = await api.post("/departments/create", input);
  revalidateTag("departments");
  return out;
}

export const metadata: Metadata = {
  title: "New Department",
  description: `New department creation page for the departments section in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

/** ---- Server renders client with typed data and actions ---- */
export default async function NewDepartmentPage() {
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  // Fetch default department detail server-side
  const departmentDetailDefault = await getDepartmentDefault({
    body: { profileId },
  });

  // Fetch initial search data (empty query) for SearchExistingStaffModal
  const initialSearchData = await searchStaff({
    body: {
      query: null,
      cohortIds: null,
      departmentIds: null,
      limit: 200,
      profileId,
    },
  });

  // Fetch initial create staff data for CreateStaffButton
  const initialCreateStaffData = await getCreateStaffData({
    body: {
      departmentIds: [],
      profileId,
    },
  });

  return (
    <div className="space-y-6">
      <Department
        departmentDetailDefault={departmentDetailDefault}
        createDepartmentAction={createDepartment}
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
export type DepartmentDefaultStaffItem = DepartmentDetailDefaultOut["staff"][number];

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateDepartmentIn,
  CreateDepartmentOut,
  DepartmentDetailDefaultIn,
  DepartmentDetailDefaultOut,
  DepartmentDefaultStaffItem,
};
