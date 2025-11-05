/**
 * app/(main)/management/staff/p/[profileId]/page.tsx
 * Staff edit page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { auth } from "@/auth";
import StaffEdit from "@/components/staff/StaffEdit";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type StaffDetailIn = InputOf<"/api/v3/profile/staff/detail", "post">;
type StaffDetailOut = OutputOf<"/api/v3/profile/staff/detail", "post">;

type UpdateStaffIn = InputOf<"/api/v3/profile/staff/update", "post">;
type UpdateStaffOut = OutputOf<"/api/v3/profile/staff/update", "post">;

type DeleteStaffIn = InputOf<"/api/v3/profile/staff/delete", "post">;
type DeleteStaffOut = OutputOf<"/api/v3/profile/staff/delete", "post">;

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getStaff = cache(
  async (input: StaffDetailIn): Promise<StaffDetailOut> => {
    return api.post("/profile/staff/detail", input);
  }
);

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ profileId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { profileId } = await params;
  const session = await auth();
  const currentProfileId = session?.effectiveProfileId || "";

  try {
    const staff = await getStaff({
      body: { profileId, currentProfileId },
    });
    return {
      title: `${staff?.name || "Staff Profile"}`,
      description: `Manage individual staff in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Staff Profile",
      description: `Manage individual staff in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function updateStaff(
  input: UpdateStaffIn
): Promise<UpdateStaffOut> {
  "use server";
  const out = await api.post("/profile/staff/update", input);
  revalidateTag("profile");
  return out;
}

export async function deleteStaff(
  input: DeleteStaffIn
): Promise<DeleteStaffOut> {
  "use server";
  const out = await api.post("/profile/staff/delete", input);
  revalidateTag("profile");
  return out;
}

/** ---- Server renders client with typed data and actions ---- */
export default async function StaffEditPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const session = await auth();
  const currentProfileId = session?.effectiveProfileId || "";

  // Fetch staff detail (cached, won't duplicate with metadata)
  const staffDetail = await getStaff({
    body: { profileId, currentProfileId },
  });

  return (
    <div className="space-y-6">
      <StaffEdit
        profileId={profileId}
        staffDetail={staffDetail}
        updateStaffAction={updateStaff}
        deleteStaffAction={deleteStaff}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteStaffIn,
  DeleteStaffOut,
  StaffDetailIn,
  StaffDetailOut,
  UpdateStaffIn,
  UpdateStaffOut,
};
