/**
 * app/(main)/management/staff/new/page.tsx
 * Staff new page for creating a new staff member.
 * @AshokSaravanan222
 * 12/04/2025
 */

import Profile from "@/components/staff/Profile";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";
import { cache } from "react";

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

/** ---- Direct fetch (no caching - source of truth) ---- */
const getStaffDefault = cache(
  async (input: GetStaffIn): Promise<GetStaffOut> => {
    return api.post("/profiles/get", input, {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    });
  }
);

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

/** ---- Metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Staff",
    description:
      "Add a new teaching staff member to the training platform. Create staff profiles, assign roles and permissions, and configure access to learning cohorts and educational resources for teaching assistant development programs.",
  };
}

/** ---- Server renders client with typed data and actions ---- */
export default async function NewStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Parse search params using nuqs
  const params = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
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

  // Fetch default staff detail server-side with draft_id
  const input: GetStaffIn = {
    body: {
      staff_id: null, // NULL for new mode
      draft_id: q.draftId ?? null,
    } as GetStaffIn["body"],
  };
  const staffDetailDefault = await getStaffDefault(input);

  return (
    <div
      className="space-y-6"
      data-page="staff-new"
      aria-label="Create new staff page"
    >
      <Profile
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        staffData={staffDetailDefault}
        saveStaffAction={saveStaff}
        createNamesAction={createDraftNames}
        createFlagsAction={createDraftFlags}
        createDepartmentsAction={createDraftDepartments}
        createEmailsAction={createDraftEmails}
        createRequestLimitsAction={createDraftRequestLimits}
      />
    </div>
  );
}

// Types are now defined inline in components using InputOf/OutputOf
