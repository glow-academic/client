/**
 * app/(main)/management/staff/p/[profileId]/page.tsx
 * Staff edit page for editing a staff member.
 * @AshokSaravanan222
 * 12/04/2025
 */

import { getSession } from "@/auth";

import { DepartmentAccessDenied } from "@/components/common/layout/DepartmentAccessDenied";
import StaffNewEdit from "@/components/staff/StaffNewEdit";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type StaffDetailIn = InputOf<"/api/v3/profile/staff/detail", "post">;
type StaffDetailOut = OutputOf<"/api/v3/profile/staff/detail", "post">;
type UpdateStaffIn = InputOf<"/api/v3/profile/staff/update", "post">;
type UpdateStaffOut = OutputOf<"/api/v3/profile/staff/update", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getStaff = async (
  profileId: string,
  currentProfileId: string
): Promise<StaffDetailOut> => {
  return api.post(
    "/profile/staff/detail",
    { body: { profileId, currentProfileId } },
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
  { params }: { params: Promise<{ profileId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { profileId } = await params;
  const session = await getSession();
  const currentProfileId = session?.effectiveProfileId || "guest-profile-id";

  let organizationName = "";
  let organizationDescription = "";
  try {
    const activeSettings = await api.post("/settings/active", {
      body: { profileId: currentProfileId },
    });
    organizationName = activeSettings.organization_name || "";
    organizationDescription = activeSettings.organization_description || "";
  } catch {
    // If settings unavailable, organizationName and organizationDescription will be empty
  }

  const orgPart = organizationName
    ? ` at ${organizationName}${organizationDescription ? ` - ${organizationDescription}` : ""}`
    : "";

  try {
    const staffDetail = await getStaff(profileId, currentProfileId);
    return {
      title: `Edit ${staffDetail.name}`,
      description: `Edit staff member in GLOW${orgPart}.`,
    };
  } catch {
    return {
      title: "Edit Staff",
      description: `Edit staff member in GLOW${orgPart}.`,
    };
  }
}

/** ---- Strongly-typed server actions ---- */
async function updateStaff(input: UpdateStaffIn): Promise<UpdateStaffOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";

  return api.post("/profile/staff/update", {
    body: { ...input.body, profileId },
  });
}

/** ---- Server renders client with typed data and actions ---- */
export default async function StaffEditPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const session = await getSession();
  const currentProfileId = session?.effectiveProfileId || "";

  // Fetch staff detail (always fresh - source of truth)
  try {
    const staffDetail = await getStaff(profileId, currentProfileId);

    return (
      <div
        className="space-y-6"
        data-page="staff-edit"
        data-profile-id={profileId}
      >
        <StaffNewEdit
          profileId={profileId}
          mode="edit"
          staffDetail={staffDetail}
          updateStaffAction={updateStaff}
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
          resourceType="staff"
          redirectPath="/management/staff"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  StaffDetailIn,
  StaffDetailOut,
  UpdateStaffIn,
  UpdateStaffOut,
};

