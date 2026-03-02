/**
 * app/(main)/management/profiles/[profileId]/page.tsx
 * Profile edit page for editing a profile.
 * @AshokSaravanan222
 * 12/04/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Profile from "@/components/artifacts/profile/Profile";
import { resolveGroupId } from "@/app/(main)/layout-server";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetProfileIn = InputOf<"/api/v4/artifacts/profiles/get", "post">;
type GetProfileOut = OutputOf<"/api/v4/artifacts/profiles/get", "post">;
type SaveProfileIn = InputOf<"/api/v4/artifacts/profiles/save", "post">;
type SaveProfileOut = OutputOf<"/api/v4/artifacts/profiles/save", "post">;
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
const getProfile = async (input: GetProfileIn): Promise<GetProfileOut> => {
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
async function saveProfile(input: SaveProfileIn): Promise<SaveProfileOut> {
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
export default async function ProfileEditPage({
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

  // Inline server-side parsers for profile search params
  const profileSearchParams = {
    draftId: parseAsString,
  };
  const loadProfileSearchParams = createLoader(profileSearchParams);
  const q = loadProfileSearchParams(searchParamsObj);

  const groupId = (await resolveGroupId({ draft_id: q.draftId ?? null, artifact_type: "profile" })).group_id;

  // Fetch profile detail (always fresh - source of truth) with draft_id
  try {
    const input: GetProfileIn = {
      body: {
        target_profile_id: profileId,
        draft_id: q.draftId ?? null,
        group_id: groupId,
      } as GetProfileIn["body"],
    };
    const profileDetail = await getProfile(input);

    return (
      <div
        className="space-y-6"
        data-page="profile-edit"
        data-profile-id={profileId}
      >
        <Profile
          key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
          profileId={profileId}
          profileData={profileDetail}
          saveProfileAction={saveProfile}
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
          redirectPath="/management/profiles"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

// Types are now defined inline in components using InputOf/OutputOf
