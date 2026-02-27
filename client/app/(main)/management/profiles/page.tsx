/**
 * app/(main)/management/profiles/page.tsx
 * Profiles page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Profiles from "@/components/artifacts/profile/Profiles";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type ProfilesListIn = InputOf<"/api/v4/artifacts/profiles/list", "post">;
type ProfilesListOut = OutputOf<"/api/v4/artifacts/profiles/list", "post">;
type DeleteProfileIn = InputOf<"/api/v4/artifacts/profiles/delete", "post">;
type DeleteProfileOut = OutputOf<"/api/v4/artifacts/profiles/delete", "post">;
type BulkDeleteProfileIn = InputOf<"/api/v4/artifacts/profiles/bulk/delete", "post">;
type BulkDeleteProfileOut = OutputOf<"/api/v4/artifacts/profiles/bulk/delete", "post">;
// profile/update doesn't exist - use profiles/save instead
// type UpdateStaffIn = InputOf<"/api/v4/profile/update", "post">;
// type UpdateStaffOut = OutputOf<"/api/v4/profile/update", "post">;
type BulkUpdateProfileIn = InputOf<"/api/v4/artifacts/profiles/bulk/save", "post">;
type BulkUpdateProfileOut = OutputOf<"/api/v4/artifacts/profiles/bulk/save", "post">;
type SearchProfileIn = InputOf<"/api/v4/artifacts/profiles/bulk/search", "post">;
type SearchProfileOut = OutputOf<"/api/v4/artifacts/profiles/bulk/search", "post">;
// Use profiles/get with null target_profile_id to get create profile data
type GetProfileIn = InputOf<"/api/v4/artifacts/profiles/get", "post">;
type GetProfileOut = OutputOf<"/api/v4/artifacts/profiles/get", "post">;
type ProcessCSVIn = InputOf<"/api/v4/artifacts/profiles/bulk/process", "post">;
type ProcessCSVOut = OutputOf<"/api/v4/artifacts/profiles/bulk/process", "post">;
type BulkCreateOrUpdateProfileIn = InputOf<"/api/v4/artifacts/profiles/bulk/save", "post">;
type BulkCreateOrUpdateProfileOut = OutputOf<"/api/v4/artifacts/profiles/bulk/save", "post">;
/** ---- Derived types from server responses ---- */
type ProfileListItem = NonNullable<ProfilesListOut["profiles"]>[number];
type SearchProfileItem = NonNullable<SearchProfileOut["profiles"]>[number];
// Extract nested types from ProcessCSV
type ProcessedCSVRow = NonNullable<ProcessCSVOut["rows"]>[number];
type CSVColumnMapping = ProcessCSVIn["body"]["column_mappings"][number];

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getProfilesList = async (input: ProfilesListIn): Promise<ProfilesListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post("/artifacts/profiles/list", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function deleteProfile(input: DeleteProfileIn): Promise<DeleteProfileOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/profiles/delete", input);
}

async function bulkDeleteProfile(
  input: BulkDeleteProfileIn
): Promise<BulkDeleteProfileOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/profiles/bulk/delete", input);
}

// Use profiles/get with null target_profile_id to get create profile data
async function getCreateProfileData(
  _input: GetProfileIn
): Promise<GetProfileOut> {
  "use server";
  return api.post("/artifacts/profiles/get", {
    body: {
      target_profile_id: null, // NULL for new mode - returns default data
      draft_id: null,
    },
  });
}

async function processCSV(input: ProcessCSVIn): Promise<ProcessCSVOut> {
  "use server";
  return api.post("/artifacts/profiles/bulk/process", input);
}

async function bulkCreateOrUpdateProfile(
  input: BulkCreateOrUpdateProfileIn
): Promise<BulkCreateOrUpdateProfileOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/profiles/bulk/save", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/profiles/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/profiles/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/profiles/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
}

export default async function ProfilesPage() {
  // Fetch list data server-side
  const listData = await getProfilesList({
    body: {},
  });

  // Fetch initial create profile data for CreateProfileButton
  const initialCreateProfileData = await getCreateProfileData({
    body: { department_ids: [] },
  });

  return (
    <div className="space-y-6">
      <Profiles
        listData={listData}
        initialCreateProfileData={initialCreateProfileData}
        deleteProfileAction={deleteProfile}
        bulkDeleteProfileAction={bulkDeleteProfile}
        processCSVAction={processCSV}
        bulkCreateOrUpdateProfileAction={bulkCreateOrUpdateProfile}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  BulkCreateOrUpdateProfileIn,
  BulkCreateOrUpdateProfileOut,
  BulkDeleteProfileIn,
  BulkDeleteProfileOut,
  BulkUpdateProfileIn,
  BulkUpdateProfileOut,
  CSVColumnMapping,
  DeleteProfileIn,
  DeleteProfileOut,
  GetProfileIn,
  GetProfileOut,
  ProcessCSVIn,
  ProcessCSVOut,
  ProcessedCSVRow,
  ProfileListItem,
  ProfilesListIn,
  ProfilesListOut,
  SearchProfileIn,
  SearchProfileItem,
  SearchProfileOut,
};
