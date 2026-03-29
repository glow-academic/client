/**
 * app/(main)/management/profiles/new/page.tsx
 * Profiles new page for creating a new profile.
 * @AshokSaravanan222
 * 12/04/2025
 */

import Profile from "@/components/artifacts/profile/Profile";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type GetProfileIn = InputOf<"/profiles/get", "post">;
type GetProfileOut = OutputOf<"/profiles/get", "post">;
type CreateProfileIn = InputOf<"/profiles/create", "post">;
type CreateProfileOut = OutputOf<"/profiles/create", "post">;
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
type PatchProfileDraftIn = InputOf<"/profiles/draft", "patch">;
type PatchProfileDraftOut = OutputOf<"/profiles/draft", "patch">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getProfileDefault = cache(
  async (input: GetProfileIn): Promise<GetProfileOut> => {
    return api.post("/profiles/get", input, {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    });
  }
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createProfile(input: CreateProfileIn): Promise<CreateProfileOut> {
  "use server";
  return api.post("/profiles/create", input);
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
  return api.patch("/profiles/draft", input);
}

/** ---- Metadata ---- */
/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/profiles/docs", "post">;
type DocsOut = OutputOf<"/profiles/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/profiles/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.new.title, description: docs.new.description };
}

/** ---- Server renders client with typed data and actions ---- */
export default async function NewProfilePage({
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

  // Inline server-side parsers for profile search params
  const profileSearchParams = {
    draftId: parseAsString,
  };
  const loadProfileSearchParams = createLoader(profileSearchParams);
  const q = loadProfileSearchParams(searchParamsObj);

  // Fetch default profile detail server-side with draft_id
  const input: GetProfileIn = {
    body: {
      target_profile_id: null, // NULL for new mode
      draft_id: q.draftId ?? null,
    } as GetProfileIn["body"],
  };
  const [profileDetailDefault, draftsResult] = await Promise.all([
    getProfileDefault(input),
    api.post("/profiles/drafts", {})
  ]);

  return (
    <DraftProviderClient drafts={draftsResult.entries ?? []}>
      <PageHeader
        breadcrumbs={[
          { title: "Management", section: "management", url: "/management" },
          { title: "Profiles", section: "profiles", url: "/management/profiles" },
          { title: "New Profile" },
        ]}
        toolbar={<SaveToolbar />}
      />
      <div
        className="space-y-6 px-4"
        data-page="profile-new"
        aria-label="Create new profile page"
      >
        <Profile
          key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
          profileData={profileDetailDefault}
          createProfileAction={createProfile}
          patchProfileDraftAction={patchProfileDraft}
          createNamesAction={createDraftNames}
          createEmailsAction={createDraftEmails}
          createRequestLimitsAction={createDraftRequestLimits}
        />
      </div>
    </DraftProviderClient>
  );
}

// Types are now defined inline in components using InputOf/OutputOf
