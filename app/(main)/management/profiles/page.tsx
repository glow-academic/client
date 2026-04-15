/**
 * app/(main)/management/profiles/page.tsx
 * Profiles list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Profiles from "@/components/artifacts/profile/Profiles";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { getLayoutContextData } from "@/app/(main)/layout-server";

/** ---- Strong types from OpenAPI ---- */
type ProfilesListIn = InputOf<"/profiles/search", "post">;
type ProfilesListOut = OutputOf<"/profiles/search", "post">;
type DeleteProfileIn = InputOf<"/profiles/delete", "post">;
type DeleteProfileOut = OutputOf<"/profiles/delete", "post">;
type BulkDeleteProfileIn = InputOf<"/profiles/bulk/delete", "post">;
type BulkDeleteProfileOut = OutputOf<"/profiles/bulk/delete", "post">;
type SearchProfileIn = InputOf<"/profiles/bulk/search", "post">;
type SearchProfileOut = OutputOf<"/profiles/bulk/search", "post">;
type GetProfileIn = InputOf<"/profiles/get", "post">;
type GetProfileOut = OutputOf<"/profiles/get", "post">;
type ProcessCSVIn = InputOf<"/profiles/bulk/process", "post">;
type ProcessCSVOut = OutputOf<"/profiles/bulk/process", "post">;
type EmulateProfileIn = InputOf<"/profiles/emulate", "post">;
type EmulateProfileOut = OutputOf<"/profiles/emulate", "post">;
type UnemulateProfileOut = OutputOf<"/profiles/unemulate", "post">;
type GroupProfileIn = InputOf<"/profiles/group", "post">;
type GroupProfileOut = OutputOf<"/profiles/group", "post">;
type GenerateProfileIn = InputOf<"/profiles/generate", "post">;
type GenerateProfileOut = OutputOf<"/profiles/generate", "post">;
type GenerationsIn = InputOf<"/profiles/generations", "post">;
type GenerationsOut = OutputOf<"/profiles/generations", "post">;
type ProblemProfileIn = InputOf<"/profiles/problem", "post">;
type ProblemProfileOut = OutputOf<"/profiles/problem", "post">;
type ContextIn = InputOf<"/profiles/context", "post">;
type ContextOut = OutputOf<"/profiles/context", "post">;
/** ---- Derived types from server responses ---- */
type ProfileListItem = NonNullable<ProfilesListOut["profiles"]>[number];
type SearchProfileItem = NonNullable<SearchProfileOut["profiles"]>[number];
type ProcessedCSVRow = NonNullable<ProcessCSVOut["rows"]>[number];
type CSVColumnMapping = ProcessCSVIn["body"]["column_mappings"][number];

/** ---- Direct fetch (no Next.js cache) ---- */
const getProfilesList = async (input: ProfilesListIn): Promise<ProfilesListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post("/profiles/search", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Strongly-typed server actions ---- */
async function deleteProfile(input: DeleteProfileIn): Promise<DeleteProfileOut> {
  "use server";
  return api.post("/profiles/delete", input);
}

async function bulkDeleteProfile(
  input: BulkDeleteProfileIn
): Promise<BulkDeleteProfileOut> {
  "use server";
  return api.post("/profiles/bulk/delete", input);
}

async function getCreateProfileData(
  _input: GetProfileIn
): Promise<GetProfileOut> {
  "use server";
  return api.post("/profiles/get", {
    body: {
      target_profile_id: null,
      draft_id: null,
    },
  });
}

async function processCSV(input: ProcessCSVIn): Promise<ProcessCSVOut> {
  "use server";
  return api.post("/profiles/bulk/process", input);
}

/** ---- Emulation server actions ---- */
type EmulateProfileActionIn = { targetProfileId: string };
type EmulateProfileActionOut = { ok: boolean; reason?: string };

async function emulateProfile(
  input: EmulateProfileActionIn
): Promise<EmulateProfileActionOut> {
  "use server";
  try {
    const res: EmulateProfileOut = await api.post("/profiles/emulate", {
      body: { target_profile_id: input.targetProfileId },
    } as EmulateProfileIn);
    if (!res.allowed) {
      return { ok: false, reason: res.reason ?? "Emulation not allowed" };
    }
    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: msg };
  }
}

async function unemulateProfile(
  input: EmulateProfileActionIn
): Promise<EmulateProfileActionOut> {
  "use server";
  try {
    const res: UnemulateProfileOut = await api.post("/profiles/unemulate", {
      body: { target_profile_id: input.targetProfileId },
    } as never);
    if (!res.ok) {
      return { ok: false, reason: res.reason ?? "Failed to exit emulation" };
    }
    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: msg };
  }
}

async function generateProfile(
  input: GenerateProfileIn
): Promise<GenerateProfileOut> {
  "use server";
  return api.post("/profiles/generate", input);
}

async function getProfileGroupHistory(groupId: string): Promise<GroupProfileOut> {
  "use server";
  return api.post("/profiles/group", { body: { group_id: groupId } } as GroupProfileIn);
}

async function searchProfileGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/profiles/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createProfileProblem(input: ProblemProfileIn): Promise<ProblemProfileOut> {
  "use server";
  return api.post("/profiles/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/profiles/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.list.title,
    description: context.page_metadata?.list.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function ProfilesPage() {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const { profileData, snapshot } = await getLayoutContextData(session);

  // Fetch list data, create profile data, and group in parallel
  const [listData, initialCreateProfileData, groupResult] = await Promise.all([
    getProfilesList({ body: {} }),
    getCreateProfileData({ body: { department_ids: [] } }),
    api.post("/profiles/group", { body: {} } as GroupProfileIn),
  ]);

  return (
    <FullPageLayout
      profileData={profileData}
      sessionSnapshot={snapshot}
      initialSidebarOpen={initialSidebarOpen}
      initialPanelOpen={initialPanelOpen}
      sidebarProps={{
        activeSection: "profile",
        createFeedback: createProfileProblem,
      }}
      breadcrumbs={[
        { title: "Management", section: "management", url: "/management" },
        { title: "Profiles" },
      ]}
      toolbar={<NewArtifactButton label="New Profile" href="/management/profiles/new" />}
      panelProps={{
        artifactType: "profile",
        groupId: (groupResult as GroupProfileOut & { group_id?: string })?.group_id ?? null,
        generateAction: generateProfile,
        permissions: [
          { artifact: "profile", operation: "draft" },
          { artifact: "profile", operation: "get" },
          { artifact: "profile", operation: "docs" },
          { artifact: "profile", operation: "group" },
        ],
        getGroupHistory: getProfileGroupHistory,
        searchGroups: searchProfileGroups,
      }}
    >
      <div className="space-y-6 px-4">
        <Profiles
          listData={listData}
          initialCreateProfileData={initialCreateProfileData}
          deleteProfileAction={deleteProfile}
          bulkDeleteProfileAction={bulkDeleteProfile}
          processCSVAction={processCSV}
          emulateProfileAction={emulateProfile}
          unemulateProfileAction={unemulateProfile}
        />
      </div>
    </FullPageLayout>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  BulkDeleteProfileIn,
  BulkDeleteProfileOut,
  CSVColumnMapping,
  DeleteProfileIn,
  DeleteProfileOut,
  EmulateProfileActionIn,
  EmulateProfileActionOut,
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
