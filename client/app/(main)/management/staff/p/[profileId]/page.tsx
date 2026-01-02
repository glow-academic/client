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
import type { Metadata, ResolvingMetadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type StaffDetailIn = InputOf<"/api/v4/staff/detail", "post">;
type StaffDetailOut = OutputOf<"/api/v4/staff/detail", "post">;
type UpdateStaffIn = InputOf<"/api/v4/staff/update", "post">;
type UpdateStaffOut = OutputOf<"/api/v4/staff/update", "post">;
type PatchStaffDraftIn = InputOf<"/api/v4/staff/draft", "patch">;
type PatchStaffDraftOut = OutputOf<"/api/v4/staff/draft", "patch">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getStaff = async (
  input: StaffDetailIn
): Promise<StaffDetailOut> => {
  return api.post("/staff/detail", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ profileId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { profileId } = await params;
  // currentProfileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const input: StaffDetailIn = {
      body: {
        target_profile_id: profileId,
        draft_id: null,
      } as StaffDetailIn["body"],
    };
    const staffDetail = await getStaff(input);
      return {
        title: `Edit ${staffDetail.name}`,
        description: `${staffDetail.name ? `Edit ${staffDetail.name} - ` : ""}Manage teaching staff member profile, role assignments, and access permissions for teaching assistant training programs. Configure staff participation in learning cohorts and educational resources.`,
      };
    } catch {
      // Fall through to default metadata
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
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/staff/update", input);
}

async function patchStaffDraft(
  input: PatchStaffDraftIn
): Promise<PatchStaffDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/staff/draft", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function StaffEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { profileId } = await params;
  // Access control handled server-side in layout
  // currentProfileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Parse search params using nuqs
  const paramsObj = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(paramsObj).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Inline server-side parsers for staff search params
  const staffSearchParams = {
    draftId: parseAsString,
  };
  const loadStaffSearchParams = createLoader(staffSearchParams);
  const q = loadStaffSearchParams(searchParamsObj);

  // Fetch staff detail (always fresh - source of truth) with draft_id
  try {
    const input: StaffDetailIn = {
      body: {
        target_profile_id: profileId,
        draft_id: q.draftId ?? null,
      } as StaffDetailIn["body"],
    };
    const staffDetail = await getStaff(input);

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
          patchStaffDraftAction={patchStaffDraft}
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
export type {
  PatchStaffDraftIn,
  PatchStaffDraftOut,
  StaffDetailIn,
  StaffDetailOut,
  UpdateStaffIn,
  UpdateStaffOut,
};
