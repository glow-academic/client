/**
 * app/(main)/management/profiles/page.tsx
 * Profiles list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Profiles from "@/components/artifacts/profile/Profiles";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { readViewCookie } from "@/lib/view-cookie";
import { loadProfilesSearchParams } from "@/lib/search-params/profiles";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
import type { ImportFieldDef, ParseCsvResult } from "@/components/common/BulkImport";
/** ---- Strong types from OpenAPI ---- */
type ProfilesListIn = InputOf<"/profile/search", "post">;
type ProfilesListOut = OutputOf<"/profile/search", "post">;

/** ---- Body type for profile list request ----
 *  Derived from the OpenAPI ``/profile/search`` input so the
 *  ``page_size`` / ``page_offset`` nullability stays in sync with the
 *  server (matches the documents sibling). Used both for the SSR fetch
 *  and as the ``currentSearchBody`` prop forwarded to the bulk-write
 *  all-matching path (``/profile/delete`` accepts the same filters). */
type ProfilesListBody = NonNullable<ProfilesListIn["body"]>;
type DeleteProfileIn = InputOf<"/profile/delete", "post">;
type DeleteProfileOut = OutputOf<"/profile/delete", "post">;
// Bulk delete is the SAME endpoint as single delete: the api's
// ``/profile/delete`` (``DeleteProfileApiRequest``) accepts either an
// explicit ``profile_ids`` list OR an all-matching body
// (``all=true`` + ``excluded_ids`` + the ``/profile/search`` filter
// fields). There is no separate ``/profile/bulk/delete`` route — the
// old name 404'd. Alias the bulk types to the real delete types.
type BulkDeleteProfileIn = DeleteProfileIn;
type BulkDeleteProfileOut = DeleteProfileOut;
type UpdateProfileIn = InputOf<"/profile/update", "post">;
type UpdateProfileOut = OutputOf<"/profile/update", "post">;
// Bulk search is the real ``/profile/search`` endpoint (same as the
// list fetch above). The old ``/profile/bulk/search`` route 404'd.
type SearchProfileIn = ProfilesListIn;
type SearchProfileOut = ProfilesListOut;
type GetProfileIn = InputOf<"/profile/get", "post">;
type GetProfileOut = OutputOf<"/profile/get", "post">;
type CreateProfileIn = InputOf<"/profile/create", "post">;
type CreateProfileOut = OutputOf<"/profile/create", "post">;
type EmulateProfileIn = InputOf<"/profile/emulate", "post">;
type EmulateProfileOut = OutputOf<"/profile/emulate", "post">;
type UnemulateProfileOut = OutputOf<"/profile/unemulate", "post">;
type GroupProfileIn = InputOf<"/profile/group", "post">;
type GroupProfileOut = OutputOf<"/profile/group", "post">;
type GenerationsIn = InputOf<"/profile/generations", "post">;
type GenerationsOut = OutputOf<"/profile/generations", "post">;
type ProblemProfileIn = InputOf<"/profile/problem", "post">;
type ProblemProfileOut = OutputOf<"/profile/problem", "post">;
type ContextIn = InputOf<"/profile/context", "post">;
type ContextOut = OutputOf<"/profile/context", "post">;
/** ---- Derived types from server responses ---- */
type ProfileListItem = NonNullable<ProfilesListOut["profiles"]>[number];
type SearchProfileItem = NonNullable<SearchProfileOut["profiles"]>[number];

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
  // Real endpoint: ``/profile/delete`` handles both explicit-id and
  // all-matching bulk deletes via ``DeleteProfileApiRequest``.
  return api.post("/profile/delete", input);
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

async function createProfile(
  input: CreateProfileIn,
): Promise<CreateProfileOut> {
  "use server";
  return api.post("/profile/create", input);
}

async function parseCsv(formData: FormData): Promise<ParseCsvResult> {
  "use server";
  return api.post(
    "/profile/csv",
    { formData } as unknown as InputOf<"/profile/csv", "post">,
  );
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


async function createProfileProblem(input: ProblemProfileIn): Promise<ProblemProfileOut> {
  "use server";
  return api.post("/profile/problem", input);
}

/** ---- GenerationPanel server actions ---- */
async function getProfileGroup(input: GroupProfileIn): Promise<GroupProfileOut> {
  "use server";
  return api.post("/profile/group", input);
}

async function searchProfileGenerations(input: GenerationsIn): Promise<GenerationsOut> {
  "use server";
  return api.post("/profile/generations", input);
}


/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getProfileContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/profile/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getProfileContext();
    return {
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Profiles" };
  }
}

/** ---- CSV import fields ----
 *  Mirrors the api's ``PROFILE_IMPORT_FIELDS`` (the source of truth the
 *  ``/profile/csv`` parser auto-maps against and that ``/profile/create``
 *  consumes via ``CreateProfileItem``). Unlike the documents sibling, the
 *  ``/profile/search`` list response does NOT echo ``import_fields``, so we
 *  declare them here. Only ``name`` (required) and ``departments`` (multi,
 *  comma-separated names) are recognized server-side — email/role are
 *  resolved per-profile elsewhere and are NOT part of the one-shot CSV
 *  contract (this is the phantom-contract gap #21 is closing). */
const PROFILE_IMPORT_FIELDS: ImportFieldDef[] = [
  {
    key: "name",
    label: "Name",
    required: true,
    example: "Jane Doe",
    description: "Profile display name",
  },
  {
    key: "departments",
    label: "Departments",
    required: false,
    multi: true,
    example: "Nursing, Medicine",
    description: "Comma-separated department names",
  },
];

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface ProfilesPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ProfilesPage({ searchParams }: ProfilesPageProps) {
  const session = await getSession();
  const q = loadProfilesSearchParams(await searchParams);

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  try {
    // Profile data for providers
    const context = await getProfileContext();
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/management/profiles", context.profile.role_permissions);

    // The current page passes empty filters (column-filter state is
    // managed client-side by TanStack today, not URL-driven). The
    // bulk-write all-matching path still gets a well-formed body so
    // the server has something to plug into the resolver — but the
    // filter fields will be null/empty until profiles' filter state
    // migrates to nuqs URL params (parity with persona/scenario).
    // This page uses client-side TanStack column filters + the name
    // search box and client-side pagination over the SSR-fetched rows,
    // so ALL matching rows must be loaded up front. ``page_size: null``
    // does NOT mean "unbounded" — ``/profile/search`` coerces a null/0
    // page size to its default of 12 (``request.page_size or 12``; the
    // SQL always applies a LIMIT), so we shipped only the first 12 of N
    // profiles and profiles 13..N were unreachable / un-searchable.
    // Request a large window so the full dataset is loaded — mirrors the
    // sibling load-all + client-filter pages (e.g. ``/platform/auth``
    // uses ``page_size: 1000``).
    const body: ProfilesListBody = {
      page_size: 1000,
      page_offset: 0,
    };

    // Fetch list data, create profile data, view cookie, and group in parallel
    const [listData, initialCreateProfileData, initialColumnVisibility, groupResult] = await Promise.all([
      getProfilesList({ body }),
      // ``GetProfileApiRequest`` exposes a ``departments`` SectionFilter
      // (object), not a ``department_ids`` array; ``getCreateProfileData``
      // ignores its input anyway and sends an empty body, so pass {}.
      getCreateProfileData({ body: {} }),
      readViewCookie("profiles"),
      api.post(
        "/profile/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupProfileIn,
      ),
    ]);

    return (
      <FullPageLayout
        profileData={context.profile}
        sessionSnapshot={snapshot}
        {...(initialSidebarOpen !== undefined && { initialSidebarOpen })}
        initialPanelOpen={initialPanelOpen}
        sidebarProps={{
          activeSection: "profile",
          createFeedback: createProfileProblem as unknown as (
            input: Record<string, unknown>,
          ) => Promise<Record<string, unknown>>,
        }}
        breadcrumbs={[
          { title: "Management", section: "management", url: "/management" },
          { title: "Profiles" },
        ]}
        toolbar={<NewArtifactButton label="New Profile" href="/management/profiles/new" />}
        panelProps={{
          artifactType: "profile",
          initialPanelPrefs: await readGenerationPanelPrefs(),
          groupId: (groupResult as GroupProfileOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as GroupProfileOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          operations: ["draft", "get", "title"],
          ...(context.prompts?.prompts && { prompts: context.prompts.prompts }),
          getGroupAction: getProfileGroup as unknown as NonNullable<
            PanelProps["getGroupAction"]
          >,
          searchGenerationsAction:
            searchProfileGenerations as unknown as NonNullable<
              PanelProps["searchGenerationsAction"]
            >,
        }}
      >
        <div className="space-y-6 px-4">
          <Profiles
            listData={listData}
            initialCreateProfileData={initialCreateProfileData}
            initialColumnVisibility={initialColumnVisibility}
            deleteProfileAction={deleteProfile}
            bulkDeleteProfileAction={bulkDeleteProfile}
            updateProfileAction={updateProfile}
            createProfileAction={createProfile}
            parseCsvAction={parseCsv}
            importFields={PROFILE_IMPORT_FIELDS}
            emulateProfileAction={emulateProfile}
            unemulateProfileAction={unemulateProfile}
            currentSearchBody={body}
          />
        </div>
      </FullPageLayout>
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error
    ) {
      // 401 → not logged in. 403 → resource belongs to a department the
      // user isn't in. Don't conflate.
      if (error.status === 401) {
        return (
          <UnifiedAccessDenied
            reason="not-logged-in"
            pathname="/management/profiles"
          />
        );
      }
      if (error.status === 403) {
        return (
          <UnifiedAccessDenied
            reason="department"
            resourceType="profile"
            redirectPath="/management/profiles"
          />
        );
      }
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  BulkDeleteProfileIn,
  BulkDeleteProfileOut,
  CreateProfileIn,
  CreateProfileOut,
  DeleteProfileIn,
  DeleteProfileOut,
  EmulateProfileActionIn,
  EmulateProfileActionOut,
  GetProfileIn,
  GetProfileOut,
  ProfileListItem,
  ProfilesListBody,
  ProfilesListIn,
  ProfilesListOut,
  SearchProfileIn,
  SearchProfileItem,
  SearchProfileOut,
  UpdateProfileIn,
  UpdateProfileOut,
};
