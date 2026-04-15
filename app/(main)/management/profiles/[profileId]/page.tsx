/**
 * app/(main)/management/profiles/[profileId]/page.tsx
 * Profile edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Profile from "@/components/artifacts/profile/Profile";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type GetProfileIn = InputOf<"/profile/get", "post">;
type GetProfileOut = OutputOf<"/profile/get", "post">;
type CreateProfileIn = InputOf<"/profile/create", "post">;
type CreateProfileOut = OutputOf<"/profile/create", "post">;
type UpdateProfileIn = InputOf<"/profile/update", "post">;
type UpdateProfileOut = OutputOf<"/profile/update", "post">;
type CreateDraftNamesIn = InputOf<"/api/v5/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v5/resources/names", "post">;
type CreateDraftEmailsIn = InputOf<"/api/v5/resources/emails", "post">;
type CreateDraftEmailsOut = OutputOf<"/api/v5/resources/emails", "post">;
type CreateDraftRequestLimitsIn = InputOf<
  "/api/v5/resources/request_limits",
  "post"
>;
type CreateDraftRequestLimitsOut = OutputOf<
  "/api/v5/resources/request_limits",
  "post"
>;
type PatchProfileDraftIn = InputOf<"/profile/draft", "patch">;
type PatchProfileDraftOut = OutputOf<"/profile/draft", "patch">;
type GroupProfileIn = InputOf<"/profile/group", "post">;
type GroupProfileOut = OutputOf<"/profile/group", "post">;
type GenerateProfileIn = InputOf<"/profile/generate", "post">;
type GenerateProfileOut = OutputOf<"/profile/generate", "post">;
type ProblemProfileIn = InputOf<"/profile/problem", "post">;
type ProblemProfileOut = OutputOf<"/profile/problem", "post">;
type ContextIn = InputOf<"/profile/context", "post">;
type ContextOut = OutputOf<"/profile/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getProfile = async (input: GetProfileIn): Promise<GetProfileOut> => {
  return api.post("/profile/get", input, {
    cache: "no-store",
    headers: { "X-Bypass-Cache": "1" },
  });
};

/** ---- Strongly-typed server actions ---- */
async function createProfile(input: CreateProfileIn): Promise<CreateProfileOut> {
  "use server";
  return api.post("/profile/create", input);
}

async function updateProfile(input: UpdateProfileIn): Promise<UpdateProfileOut> {
  "use server";
  return api.post("/profile/update", input);
}

async function createDraftNames(
  input: CreateDraftNamesIn
): Promise<CreateDraftNamesOut> {
  "use server";
  return api.post("/resources/names", input);
}

async function createDraftEmails(
  input: CreateDraftEmailsIn
): Promise<CreateDraftEmailsOut> {
  "use server";
  return api.post("/resources/emails", input);
}

async function createDraftRequestLimits(
  input: CreateDraftRequestLimitsIn
): Promise<CreateDraftRequestLimitsOut> {
  "use server";
  return api.post("/resources/request_limits", input);
}

async function patchProfileDraft(
  input: PatchProfileDraftIn
): Promise<PatchProfileDraftOut> {
  "use server";
  return api.patch("/profile/draft", input);
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

type GenerationsIn = InputOf<"/profile/generations", "post">;
type GenerationsOut = OutputOf<"/profile/generations", "post">;

async function searchProfileGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/profile/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createProfileProblem(input: ProblemProfileIn): Promise<ProblemProfileOut> {
  "use server";
  return api.post("/profile/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ profileId: string }>;
}): Promise<Metadata> {
  const { profileId } = await params;
  const context = await api.post("/profile/context", { body: { entity_id: profileId } } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.detail.title,
    description: context.page_metadata?.detail.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function ProfileEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { profileId } = await params;
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/profile/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

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

  const profileSearchParams = {
    draftId: parseAsString,
  };
  const loadProfileSearchParams = createLoader(profileSearchParams);
  const q = loadProfileSearchParams(searchParamsObj);

  try {
    const input: GetProfileIn = {
      body: {
        target_profile_id: profileId,
        draft_id: q.draftId ?? null,
      } as GetProfileIn["body"],
    };

    const [profileDetail, context, draftsResult, groupResult] = await Promise.all([
      getProfile(input),
      api.post("/profile/context", { body: { entity_id: profileId } } as ContextIn) as Promise<ContextOut>,
      api.post("/profile/drafts", {}),
      api.post("/profile/group", { body: {} } as GroupProfileIn),
    ]);

    const entityName = context.page_metadata?.detail.title;

    return (
      <DraftProviderClient drafts={draftsResult.entries ?? []}>
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
            { title: "Profiles", section: "profiles", url: "/management/profiles" },
            { title: entityName },
          ]}
          toolbar={<SaveToolbar />}
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
          <div
            className="space-y-6 px-4"
            data-page="profile-edit"
            data-profile-id={profileId}
          >
            <Profile
              key={q.draftId || "no-draft"}
              profileId={profileId}
              profileData={profileDetail}
              createProfileAction={createProfile}
              updateProfileAction={updateProfile}
              patchProfileDraftAction={patchProfileDraft}
              createNamesAction={createDraftNames}
              createEmailsAction={createDraftEmails}
              createRequestLimitsAction={createDraftRequestLimits}
            />
          </div>
        </FullPageLayout>
      </DraftProviderClient>
    );
  } catch (error: unknown) {
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
          redirectPath="/management/profiles"
        />
      );
    }
    throw error;
  }
}
