/**
 * app/(main)/management/staff/page.tsx
 * Staff page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";

import Staff from "@/components/staff/Staff";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type StaffListIn = InputOf<"/api/v3/profile/staff/list", "post">;
type StaffListOut = OutputOf<"/api/v3/profile/staff/list", "post">;
type DeleteStaffIn = InputOf<"/api/v3/profile/staff/delete", "post">;
type DeleteStaffOut = OutputOf<"/api/v3/profile/staff/delete", "post">;
type BulkDeleteStaffIn = InputOf<"/api/v3/profile/staff/bulk-delete", "post">;
type BulkDeleteStaffOut = OutputOf<"/api/v3/profile/staff/bulk-delete", "post">;
type UpdateStaffIn = InputOf<"/api/v3/profile/staff/update", "post">;
type UpdateStaffOut = OutputOf<"/api/v3/profile/staff/update", "post">;
type BulkUpdateStaffIn = InputOf<"/api/v3/profile/staff/bulk-update", "post">;
type BulkUpdateStaffOut = OutputOf<"/api/v3/profile/staff/bulk-update", "post">;
type StaffDetailIn = InputOf<"/api/v3/profile/staff/detail", "post">;
type StaffDetailOut = OutputOf<"/api/v3/profile/staff/detail", "post">;
type StaffDetailBulkIn = InputOf<"/api/v3/profile/staff/detail-bulk", "post">;
type StaffDetailBulkOut = OutputOf<"/api/v3/profile/staff/detail-bulk", "post">;
type SearchStaffIn = InputOf<"/api/v3/profile/staff/search-staff", "post">;
type SearchStaffOut = OutputOf<"/api/v3/profile/staff/search-staff", "post">;
type CreateStaffDataIn = InputOf<
  "/api/v3/profile/staff/create-staff-data",
  "post"
>;
type CreateStaffDataOut = OutputOf<
  "/api/v3/profile/staff/create-staff-data",
  "post"
>;
type ProcessCSVIn = InputOf<"/api/v3/profile/staff/process-csv", "post">;
type ProcessCSVOut = OutputOf<"/api/v3/profile/staff/process-csv", "post">;
type BulkCreateOrUpdateStaffIn = InputOf<
  "/api/v3/profile/staff/bulk-create-or-update-staff",
  "post"
>;
type BulkCreateOrUpdateStaffOut = OutputOf<
  "/api/v3/profile/staff/bulk-create-or-update-staff",
  "post"
>;
/** ---- Derived types from server responses ---- */
type ProfileListItem = StaffListOut["staff"][number];
type SearchStaffItem = SearchStaffOut["staff"][number];
// Extract nested types from ProcessCSV
type ProcessedCSVRow = ProcessCSVOut["rows"][number];
type CSVColumnMapping = ProcessCSVIn["body"]["column_mappings"][number];

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getStaffList = cache(
  async (input: StaffListIn): Promise<StaffListOut> => {
    return api.post("/profile/staff/list", input);
  },
);

const getInitialSearchData = cache(
  async (input: SearchStaffIn): Promise<SearchStaffOut> => {
    return api.post("/profile/staff/search-staff", input);
  },
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function deleteStaff(
  input: DeleteStaffIn,
): Promise<DeleteStaffOut> {
  "use server";
  const out = await api.post("/profile/staff/delete", input);
  revalidateTag("profile");
  return out;
}

export async function bulkDeleteStaff(
  input: BulkDeleteStaffIn,
): Promise<BulkDeleteStaffOut> {
  "use server";
  const out = await api.post("/profile/staff/bulk-delete", input);
  revalidateTag("profile");
  return out;
}

export async function updateStaff(
  input: UpdateStaffIn,
): Promise<UpdateStaffOut> {
  "use server";
  const out = await api.post("/profile/staff/update", input);
  revalidateTag("profile");
  return out;
}

export async function bulkUpdateStaff(
  input: BulkUpdateStaffIn,
): Promise<BulkUpdateStaffOut> {
  "use server";
  const out = await api.post("/profile/staff/bulk-update", input);
  revalidateTag("profile");
  return out;
}

export async function getStaffDetail(
  input: StaffDetailIn,
): Promise<StaffDetailOut> {
  "use server";
  return api.post("/profile/staff/detail", input);
}

export async function getStaffDetailBulk(
  input: StaffDetailBulkIn,
): Promise<StaffDetailBulkOut> {
  "use server";
  return api.post("/profile/staff/detail-bulk", input);
}

export async function searchStaff(
  input: SearchStaffIn,
): Promise<SearchStaffOut> {
  "use server";
  return api.post("/profile/staff/search-staff", input);
}

export async function getCreateStaffData(
  input: CreateStaffDataIn,
): Promise<CreateStaffDataOut> {
  "use server";
  return api.post("/profile/staff/create-staff-data", input);
}

export async function processCSV(input: ProcessCSVIn): Promise<ProcessCSVOut> {
  "use server";
  return api.post("/profile/staff/process-csv", input);
}

export async function bulkCreateOrUpdateStaff(
  input: BulkCreateOrUpdateStaffIn,
): Promise<BulkCreateOrUpdateStaffOut> {
  "use server";
  const out = await api.post(
    "/profile/staff/bulk-create-or-update-staff",
    input,
  );
  revalidateTag("profile");
  return out;
}

export const metadata: Metadata = {
  title: "Staff",
  description: `Manage staff in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function StaffPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getStaffList({
    body: { profileId },
  });

  // Fetch initial search data (empty query) for SearchExistingStaffModal
  const initialSearchData = await getInitialSearchData({
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
      <Staff
        listData={listData}
        initialSearchData={initialSearchData}
        initialCreateStaffData={initialCreateStaffData}
        deleteStaffAction={deleteStaff}
        bulkDeleteStaffAction={bulkDeleteStaff}
        updateStaffAction={updateStaff}
        bulkUpdateStaffAction={bulkUpdateStaff}
        getStaffDetailAction={getStaffDetail}
        getStaffDetailBulkAction={getStaffDetailBulk}
        searchStaffAction={searchStaff}
        processCSVAction={processCSV}
        bulkCreateOrUpdateStaffAction={bulkCreateOrUpdateStaff}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  BulkCreateOrUpdateStaffIn,
  BulkCreateOrUpdateStaffOut,
  BulkDeleteStaffIn,
  BulkDeleteStaffOut,
  BulkUpdateStaffIn,
  BulkUpdateStaffOut,
  CSVColumnMapping,
  CreateStaffDataIn,
  CreateStaffDataOut,
  DeleteStaffIn,
  DeleteStaffOut,
  ProcessCSVIn,
  ProcessCSVOut,
  ProcessedCSVRow,
  SearchStaffIn,
  SearchStaffOut,
  StaffDetailBulkIn,
  StaffDetailBulkOut,
  StaffDetailIn,
  StaffDetailOut,
  StaffListIn,
  StaffListOut,
  UpdateStaffIn,
  UpdateStaffOut,
  ProfileListItem,
  SearchStaffItem,
};
