/**
 * app/(main)/management/staff/page.tsx
 * Staff page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { auth } from "@/auth";
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

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getStaffList = cache(
  async (input: StaffListIn): Promise<StaffListOut> => {
    return api.post("/profile/staff/list", input);
  }
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function deleteStaff(
  input: DeleteStaffIn
): Promise<DeleteStaffOut> {
  "use server";
  const out = await api.post("/profile/staff/delete", input);
  revalidateTag("profile");
  return out;
}

export async function bulkDeleteStaff(
  input: BulkDeleteStaffIn
): Promise<BulkDeleteStaffOut> {
  "use server";
  const out = await api.post("/profile/staff/bulk-delete", input);
  revalidateTag("profile");
  return out;
}

export async function updateStaff(
  input: UpdateStaffIn
): Promise<UpdateStaffOut> {
  "use server";
  const out = await api.post("/profile/staff/update", input);
  revalidateTag("profile");
  return out;
}

export async function bulkUpdateStaff(
  input: BulkUpdateStaffIn
): Promise<BulkUpdateStaffOut> {
  "use server";
  const out = await api.post("/profile/staff/bulk-update", input);
  revalidateTag("profile");
  return out;
}

export const metadata: Metadata = {
  title: "Staff",
  description: `Manage staff in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function StaffPage() {
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getStaffList({
    body: { profileId },
  });

  return (
    <div className="space-y-6">
      <Staff
        listData={listData}
        deleteStaffAction={deleteStaff}
        bulkDeleteStaffAction={bulkDeleteStaff}
        updateStaffAction={updateStaff}
        bulkUpdateStaffAction={bulkUpdateStaff}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  BulkDeleteStaffIn,
  BulkDeleteStaffOut,
  BulkUpdateStaffIn,
  BulkUpdateStaffOut,
  DeleteStaffIn,
  DeleteStaffOut,
  StaffListIn,
  StaffListOut,
  UpdateStaffIn,
  UpdateStaffOut,
};
