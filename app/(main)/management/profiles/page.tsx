/**
 * app/(main)/management/profiles/page.tsx
 * Profiles list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Profiles from "@/components/artifacts/profile/Profiles";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";

/** ---- Strong types from OpenAPI ---- */
type ProfilesListIn = InputOf<"/profile/search", "post">;
type ProfilesListOut = OutputOf<"/profile/search", "post">;
type DeleteProfileIn = InputOf<"/profile/delete", "post">;
type DeleteProfileOut = OutputOf<"/profile/delete", "post">;
type BulkDeleteProfileIn = InputOf<"/profile/bulk/delete", "post">;
type BulkDeleteProfileOut = OutputOf<"/profile/bulk/delete", "post">;
type UpdateProfileIn = InputOf<"/profile/update", "post">;
type UpdateProfileOut = OutputOf<"/profile/update", "post">;
type SearchProfileIn = InputOf<"/profile/bulk/search", "post">;
type SearchProfileOut = OutputOf<"/profile/bulk/search", "post">;
type GetProfileIn = InputOf<"/profile/get", "post">;
type GetProfileOut = OutputOf<"/profile/get", "post">;
type ProcessCSVIn = InputOf<"/profile/bulk/process", "post">;
type ProcessCSVOut = OutputOf<"/profile/bulk/process", "post">;
type EmulateProfileIn = InputOf<"/profile/emulate", "post">;
type EmulateProfileOut = OutputOf<"/profile/emulate", "post">;
type UnemulateProfileOut = OutputOf<"/profile/unemulate", "post">;
type GroupProfileIn = InputOf<"/profile/group", "post">;
type GroupProfileOut = OutputOf<"/profile/group", "post">;
type GenerateProfileIn = InputOf<"/profile/generate", "post">;
type GenerateProfileOut = OutputOf<"/profile/generate", "post">;
type GenerationsIn = InputOf<"/profile/generations", "post">;
type GenerationsOut = OutputOf<"/profile/generations", "post">;
type ProblemProfileIn = InputOf<"/profile/problem", "post">;
type ProblemProfileOut = OutputOf<"/profile/problem", "post">;
type ContextIn = InputOf<"/profile/context", "post">;
type ContextOut = OutputOf<"/profile/context", "post">;
/** ---- Derived types from server responses ---- */
type ProfileListItem = NonNullable<ProfilesListOut["profiles"]>[number];
type SearchProfileItem = NonNullable<SearchProfileOut["profiles"]>[number];
type ProcessedCSVRow = NonNullable<ProcessCSVOut["rows"]>[number];
type CSVColumnMapping = ProcessCSVIn["body"]["column_mappings"][number];

/** ---- Direct fetch (no Next.js cache) ---- */
const getProfilesList = async (input: ProfilesListIn): Promise<ProfilesListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post("/profile/search", input, {
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
  return api.post("/profile/delete", input);
}

async function bulkDeleteProfile(
  input: BulkDeleteProfileIn
): Promise<BulkDeleteProfileOut> {
  "use server";
  return api.post("/profile/bulk/delete", input);
}

async function updateProfile(
  input: UpdateProfileIn
): Promise<UpdateProfileOut> {
  "use server";
  return api.post("/profile/update", input);
}

async function getCreateProfileData(
  _input: GetProfileIn
): Promise<GetProfileOut> {
  "use server";
  return api.post("/profile/get", {
    body: {
      target_profile_id: null,
      draft_id: null,
    },
  });
}

async function processCSV(input: ProcessCSVIn): Promise<ProcessCSVOut> {
  "use server";
  return api.post("/profile/bulk/process", input);
}

/** ---- Emulation server actions ---- */
type EmulateProfileActionIn = { targetProfileId: string };
type EmulateProfileActionOut = { ok: boolean; reason?: string };

async function emulateProfile(
  input: EmulateProfileActionIn
): Promise<EmulateProfileActionOut> {
  "use server";
  try {
    const res: EmulateProfileOut = await api.post("/profile/emulate", {
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
    const res: UnemulateProfileOut = await api.post("/profile/unemulate", {
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
  return api.post("/profile/generate", input);
}

async function getProfileGroupHistory(groupId: string): Promise<GroupProfileOut> {
  "use server";
  return api.post("/profile/group", { body: { group_id: groupId } } as GroupProfileIn);
}

async function searchProfileGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/profile/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createProfileProblem(input: ProblemProfileIn): Promise<ProblemProfileOut> {
  "use server";
  return api.post("/profile/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await api.post("/profile/context", { body: {} } as ContextIn) as ContextOut;
    return {
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Profiles" };
  }
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

  try {
    // Profile data for providers
    const context = await api.post("/profile/context", { body: {} } as ContextIn) as ContextOut;
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/management/profiles", context.profile.role_permissions);

    // Fetch list data, create profile data, and group in parallel
    const [listData, initialCreateProfileData, groupResult] = await Promise.all([
      getProfilesList({ body: {} }),
      getCreateProfileData({ body: { department_ids: [] } }),
      api.post("/profile/group", { body: {} } as GroupProfileIn),
    ]);

    return (
      <FullPageLayout
        profileData={context.profile}
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
          operations: ["draft", "get", "group"],
          getGroupHistory: getProfileGroupHistory,
          searchGroups: searchProfileGroups,
          prompts: context.prompts?.prompts,
        }}
      >
        <div className="space-y-6 px-4">
          <Profiles
            listData={listData}
            initialCreateProfileData={initialCreateProfileData}
            deleteProfileAction={deleteProfile}
            bulkDeleteProfileAction={bulkDeleteProfile}
            updateProfileAction={updateProfile}
            processCSVAction={processCSV}
            emulateProfileAction={emulateProfile}
            unemulateProfileAction={unemulateProfile}
          />
        </div>
      </FullPageLayout>
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error.status === 401 || error.status === 403)
    ) {
      return (
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname="/management/profiles"
        />
      );
    }
    throw error;
  }
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
  UpdateProfileIn,
  UpdateProfileOut,
};
