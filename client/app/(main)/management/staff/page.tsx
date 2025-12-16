/**
 * app/(main)/management/staff/page.tsx
 * Staff page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Staff from "@/components/staff/Staff";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { getSession } from "@/auth";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type StaffListIn = InputOf<"/api/v3/staff/list", "post">;
type StaffListOut = OutputOf<"/api/v3/staff/list", "post">;
type DeleteStaffIn = InputOf<"/api/v3/staff/delete", "post">;
type DeleteStaffOut = OutputOf<"/api/v3/staff/delete", "post">;
type BulkDeleteStaffIn = InputOf<"/api/v3/staff/bulk/delete", "post">;
type BulkDeleteStaffOut = OutputOf<"/api/v3/staff/bulk/delete", "post">;
type UpdateStaffIn = InputOf<"/api/v3/staff/update", "post">;
type UpdateStaffOut = OutputOf<"/api/v3/staff/update", "post">;
type BulkUpdateStaffIn = InputOf<"/api/v3/staff/bulk/update", "post">;
type BulkUpdateStaffOut = OutputOf<"/api/v3/staff/bulk/update", "post">;
type SearchStaffIn = InputOf<"/api/v3/staff/search", "post">;
type SearchStaffOut = OutputOf<"/api/v3/staff/search", "post">;
type CreateStaffDataIn = InputOf<
  "/api/v3/staff/data/create",
  "post"
>;
type CreateStaffDataOut = OutputOf<
  "/api/v3/staff/data/create",
  "post"
>;
type ProcessCSVIn = InputOf<"/api/v3/staff/csv", "post">;
type ProcessCSVOut = OutputOf<"/api/v3/staff/csv", "post">;
type BulkCreateOrUpdateStaffIn = InputOf<
  "/api/v3/staff/bulk/upsert",
  "post"
>;
type BulkCreateOrUpdateStaffOut = OutputOf<
  "/api/v3/staff/bulk/upsert",
  "post"
>;
/** ---- Derived types from server responses ---- */
type ProfileListItem = StaffListOut["staff"][number];
type SearchStaffItem = SearchStaffOut["staff"][number];
// Extract nested types from ProcessCSV
type ProcessedCSVRow = ProcessCSVOut["rows"][number];
type CSVColumnMapping = ProcessCSVIn["body"]["column_mappings"][number];

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getStaffList = async (input: StaffListIn): Promise<StaffListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post("/staff/list", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function deleteStaff(
  input: DeleteStaffIn
): Promise<DeleteStaffOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/staff/delete", input);
}

async function bulkDeleteStaff(
  input: BulkDeleteStaffIn
): Promise<BulkDeleteStaffOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/staff/bulk/delete", input);
}

async function getCreateStaffData(
  input: CreateStaffDataIn
): Promise<CreateStaffDataOut> {
  "use server";
  return api.post("/staff/data/create", input);
}

async function processCSV(input: ProcessCSVIn): Promise<ProcessCSVOut> {
  "use server";
  return api.post("/staff/csv", input);
}

async function bulkCreateOrUpdateStaff(
  input: BulkCreateOrUpdateStaffIn
): Promise<BulkCreateOrUpdateStaffOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/staff/bulk/upsert", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Staff",
    description:
      "Manage teaching staff and role assignments for teaching assistant training programs. Organize staff members, assign roles and permissions, and coordinate learning cohort participation for effective L&D program administration.",
  };
}

export default async function StaffPage() {
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  // Fetch list data server-side
  const listData = await getStaffList({
    body: { profileId },
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
        initialCreateStaffData={initialCreateStaffData}
        deleteStaffAction={deleteStaff}
        bulkDeleteStaffAction={bulkDeleteStaff}
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
  CreateStaffDataIn,
  CreateStaffDataOut,
  CSVColumnMapping,
  DeleteStaffIn,
  DeleteStaffOut,
  ProcessCSVIn,
  ProcessCSVOut,
  ProcessedCSVRow,
  ProfileListItem,
  SearchStaffIn,
  SearchStaffItem,
  SearchStaffOut,
  StaffListIn,
  StaffListOut,
  UpdateStaffIn,
  UpdateStaffOut,
};
