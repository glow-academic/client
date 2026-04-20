/**
 * app/(main)/management/profiles/new/page.tsx
 * New profile page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Profile from "@/components/artifacts/profile/Profile";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";
import { cache } from "react";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type GetProfileIn = InputOf<"/profile/get", "post">;
type GetProfileOut = OutputOf<"/profile/get", "post">;
type CreateProfileIn = InputOf<"/profile/create", "post">;
type CreateProfileOut = OutputOf<"/profile/create", "post">;
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
const getProfileDefault = cache(
  async (input: GetProfileIn): Promise<GetProfileOut> => {
    return api.post("/profile/get", input, {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    });
  }
);

/** ---- Strongly-typed server actions ---- */
async function createProfile(input: CreateProfileIn): Promise<CreateProfileOut> {
  "use server";
  return api.post("/profile/create", input);
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
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await api.post("/profile/context", { body: {} } as ContextIn) as ContextOut;
    return {
      title: context.page_metadata?.new.title,
      description: context.page_metadata?.new.description,
    };
  } catch {
    return { title: "Profiles" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function NewProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
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

    const profileSearchParams = {
      draftId: parseAsString,
      roleSearch: parseAsString,
      roleShowSelected: parseAsBoolean,
    };
    const loadProfileSearchParams = createLoader(profileSearchParams);
    const q = loadProfileSearchParams(searchParamsObj);

    // SSR data fetches
    const body = {
      id: null,
      draft_id: q.draftId ?? null,
      ...(q.roleSearch || q.roleShowSelected !== null
        ? {
            roles: {
              ...(q.roleSearch ? { search: q.roleSearch } : {}),
              ...(q.roleShowSelected !== null ? { selected: q.roleShowSelected } : {}),
            },
          }
        : {}),
    };
    const input = {
      path: undefined,
      body,
    } as GetProfileIn;

    const [profileDetailDefault, draftsResult, groupResult] = await Promise.all([
      getProfileDefault(input),
      api.post(
        "/profile/drafts",
        { path: undefined } as InputOf<"/profile/drafts", "post">,
      ),
      api.post("/profile/group", { body: {} } as GroupProfileIn),
    ]);

    return (
      <DraftProviderClient drafts={(draftsResult.entries ?? []) as any}>
        <FullPageLayout
          {...({
            profileData: context.profile,
            sessionSnapshot: snapshot,
            initialSidebarOpen,
            initialPanelOpen,
            sidebarProps: {
              activeSection: "profile",
              createFeedback: createProfileProblem as any,
            },
            breadcrumbs: [
              { title: "Management", section: "management", url: "/management" },
              { title: "Profiles", section: "profiles", url: "/management/profiles" },
              { title: "New Profile" },
            ],
            toolbar: <SaveToolbar />,
            panelProps: {
              artifactType: "profile",
              groupId:
                (groupResult as GroupProfileOut & { group_id?: string })?.group_id ??
                null,
              generateAction: generateProfile,
              operations: ["draft", "get", "group"],
              getGroupHistory: getProfileGroupHistory,
              searchGroups: searchProfileGroups,
              prompts: context.prompts?.prompts,
            },
          } as any)}
        >
          <div
            className="space-y-6 px-4"
            data-page="profile-new"
            aria-label="Create new profile page"
          >
            <Profile
              mode="create"
              profileData={profileDetailDefault}
              createProfileAction={createProfile}
              patchProfileDraftAction={patchProfileDraft}
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
      (error.status === 401 || error.status === 403)
    ) {
      return (
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname="/management/profiles/new"
        />
      );
    }
    throw error;
  }
}
