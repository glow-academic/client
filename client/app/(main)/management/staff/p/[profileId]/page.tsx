/**
 * app/(main)/management/staff/p/[profileId]/page.tsx
 * Staff edit page for editing a staff member.
 * @AshokSaravanan222
 * 12/04/2025
 */


import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import StaffNewEdit from "@/components/staff/StaffNewEdit";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { getSession } from "@/auth";
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
  currentProfileId: string,
): Promise<StaffDetailOut> => {
  return api.post(
    "/profile/staff/detail",
    { body: { profileId, currentProfileId } },
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
  { params }: { params: Promise<{ profileId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { profileId } = await params;
  const session = await getSession();
  const currentProfileId = session?.effectiveProfileId;

  if (currentProfileId) {
    try {
      const staffDetail = await getStaff(profileId, currentProfileId);
      return {
        title: `Edit ${staffDetail.name}`,
        description: `${staffDetail.name ? `Edit ${staffDetail.name} - ` : ""}Manage teaching staff member profile, role assignments, and access permissions for teaching assistant training programs. Configure staff participation in learning cohorts and educational resources.`,
      };
    } catch {
      // Fall through to default metadata
    }
  }

  return {
    title: "Edit Staff",
    description:
      "Manage teaching staff member profile, role assignments, and access permissions for teaching assistant training programs. Configure staff participation in learning cohorts and educational resources.",
  };
}

/** ---- Strongly-typed server actions ---- */
async function updateStaff(input: UpdateStaffIn): Promise<UpdateStaffOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId;
  if (!profileId) {
    throw new Error("Authentication required");
  }

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
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const currentProfileId = session?.effectiveProfileId;

  if (!currentProfileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

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
        <UnifiedAccessDenied
          reason="department"
          resourceType="department"
          redirectPath="/management/staff"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type { StaffDetailIn, StaffDetailOut, UpdateStaffIn, UpdateStaffOut };
