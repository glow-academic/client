/**
 * app/(main)/management/staff/[profileId]/page.tsx
 * Staff edit page for editing a staff member.
 * @AshokSaravanan222
 * 12/04/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Profile from "@/components/artifacts/profile/Profile";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetStaffIn = InputOf<"/api/v4/artifacts/profiles/get", "post">;
type GetStaffOut = OutputOf<"/api/v4/artifacts/profiles/get", "post">;
type SaveStaffIn = InputOf<"/api/v4/artifacts/profiles/save", "post">;
type SaveStaffOut = OutputOf<"/api/v4/artifacts/profiles/save", "post">;
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
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
type PatchProfileDraftIn = InputOf<"/api/v4/artifacts/profiles/draft", "patch">;
type PatchProfileDraftOut = OutputOf<"/api/v4/artifacts/profiles/draft", "patch">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getStaff = async (input: GetStaffIn): Promise<GetStaffOut> => {
  return api.post("/artifacts/profiles/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/profiles/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/profiles/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/profiles/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ profileId: string }>;
}): Promise<Metadata> {
  const { profileId } = await params;
  const docs = await getDocs({ body: { entity_id: profileId } });
  return { title: docs.detail.title, description: docs.detail.description };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function saveStaff(input: SaveStaffIn): Promise<SaveStaffOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/profiles/save", input);
}

async function createDraftNames(
  input: CreateDraftNamesIn
): Promise<CreateDraftNamesOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/names", input);
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

async function patchProfileDraft(
  input: PatchProfileDraftIn
): Promise<PatchProfileDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/artifacts/profiles/draft", input);
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
        target_profile_id: profileId,
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
          patchProfileDraftAction={patchProfileDraft}
          createNamesAction={createDraftNames}
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
