/**
 * app/(main)/management/staff/p/[profileId]/page.tsx
 * Staff edit page for editing a staff member.
 * @AshokSaravanan222
 * 12/04/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Profile from "@/components/staff/Profile";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetStaffIn = InputOf<"/api/v4/profiles/get", "post">;
type GetStaffOut = OutputOf<"/api/v4/profiles/get", "post">;
type SaveStaffIn = InputOf<"/api/v4/profiles/save", "post">;
type SaveStaffOut = OutputOf<"/api/v4/profiles/save", "post">;
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;
type CreateDraftDepartmentsIn = InputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftDepartmentsOut = OutputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftEmailsIn = InputOf<"/api/v4/resources/emails", "post">;
type CreateDraftEmailsOut = OutputOf<"/api/v4/resources/emails", "post">;
type CreateDraftRequestLimitsIn = InputOf<
  "/api/v4/resources/request_limits",
  "post"
>;
type CreateDraftRequestLimitsOut = OutputOf<
  "/api/v4/resources/request_limits",
  "post"
>;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getStaff = async (input: GetStaffIn): Promise<GetStaffOut> => {
  return api.post("/profiles/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ profileId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { profileId } = await params;
  // currentProfileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const input: GetStaffIn = {
      body: {
        staff_id: profileId,
        draft_id: null,
      } as GetStaffIn["body"],
    };
    const staffDetail = await getStaff(input);
    const staffName =
      staffDetail.first_name && staffDetail.last_name
        ? `${staffDetail.first_name} ${staffDetail.last_name}`
        : staffDetail.name;
    return {
      title: `Edit ${staffName || "Staff"}`,
      description: `${staffName ? `Edit ${staffName} - ` : ""}Manage teaching staff member profile, role assignments, and access permissions for teaching assistant training programs. Configure staff participation in learning cohorts and educational resources.`,
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

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function saveStaff(input: SaveStaffIn): Promise<SaveStaffOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/profiles/save", input);
}

async function createDraftNames(
  input: CreateDraftNamesIn
): Promise<CreateDraftNamesOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/names", input);
}

async function createDraftFlags(
  input: CreateDraftFlagsIn
): Promise<CreateDraftFlagsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/flags", input);
}

async function createDraftDepartments(
  input: CreateDraftDepartmentsIn
): Promise<CreateDraftDepartmentsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/departments", input);
}

async function createDraftEmails(
  input: CreateDraftEmailsIn
): Promise<CreateDraftEmailsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/emails", input);
}

async function createDraftRequestLimits(
  input: CreateDraftRequestLimitsIn
): Promise<CreateDraftRequestLimitsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/request_limits", input);
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
    const input: GetStaffIn = {
      body: {
        staff_id: profileId,
        draft_id: q.draftId ?? null,
      } as GetStaffIn["body"],
    };
    const staffDetail = await getStaff(input);

    return (
      <div
        className="space-y-6"
        data-page="staff-edit"
        data-profile-id={profileId}
      >
        <Profile
          key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
          staffId={profileId}
          staffData={staffDetail}
          saveStaffAction={saveStaff}
          createNamesAction={createDraftNames}
          createFlagsAction={createDraftFlags}
          createDepartmentsAction={createDraftDepartments}
          createEmailsAction={createDraftEmails}
          createRequestLimitsAction={createDraftRequestLimits}
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

// Types are now defined inline in components using InputOf/OutputOf
