/**
 * app/(main)/practice/custom/page.tsx
 * Customize practice session page.
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */

import PracticeCustomize from "@/components/practice/PracticeCustomize";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";
import { getLayoutContext, type ProfileItem } from "../../layout-server";

/** ---- Strong types from OpenAPI ---- */
type PracticeIn = InputOf<"/api/v4/training/get", "post">;
type PracticeOut = OutputOf<"/api/v4/training/get", "post">;
/** ---- Direct fetch (no Next.js cache) ----
 * Practice overview responses can get large and exceed Next.js 2MB cache limit.
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getPractice = async (input: PracticeIn): Promise<PracticeOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/training/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};


export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Customize Practice Session",
    description:
      "Customize your practice session by selecting a target persona and specific parameters. Practice with realistic student interaction scenarios tailored to your needs.",
  };
}

export default async function PracticeCustomPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Access control handled server-side in layout
  // Practice page allows guest role users (authenticated users with guest role)
  // profileIds come from X-Profile-Id header (auto-injected by request-core.ts) or cookies

  // Get profileId and departmentIds from profile context with resolved UUIDs
  // Use cached layout context (reuses data already fetched by layout)
  // profileIds come from X-Profile-Id header (auto-injected by request-core.ts) or cookies
  let profileContext;
  try {
    profileContext = await getLayoutContext({
      body: {},
    });
  } catch (error) {
    // Handle 401 Unauthorized (invalid session - profile doesn't exist)
    // This can happen if the database was reset but the session still has old profile IDs
    // The layout's getLayoutContextData will also fail with the same 401 error,
    // and the layout will show access denied UI. Re-throw the error so the layout handles it.
    if (
      error instanceof Error &&
      "status" in error &&
      (error as { status: number }).status === 401
    ) {
      // Re-throw the error - the layout's getLayoutContextData will also fail with 401,
      // and the updated layout code will show access denied UI
      throw error;
    }
    // Re-throw other errors
    throw error;
  }

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

  // Inline server-side parsers for practice search params (draftId only)
  const practiceSearchParams = {
    draftId: parseAsString,
  };
  const loadPracticeSearchParams = createLoader(practiceSearchParams);
  const q = loadPracticeSearchParams(searchParamsObj);

  // Build practice filters (only department_ids) - convert to snake_case
  // profile_id removed - comes from X-Profile-Id header automatically
  // Always pass department_ids (never empty array) - use all IDs from profile context
  const practiceFiltersBody: PracticeIn["body"] = {
    department_ids: profileContext.department_ids || [], // Always pass (non-empty from profile context)
    draft_id: q.draftId ?? null,
  };

  const practiceFilters: PracticeIn = {
    body: practiceFiltersBody,
  };

  // Fetch practice data server-side
  const practiceData = await getPractice(practiceFilters);

  // Extract ProfileItem objects from LayoutContextOut
  // LayoutContextOut has effective profile fields directly (id, name, etc.)
  // and actual profile fields prefixed with actual_ (actual_id, actual_name, etc.)
  const profile: ProfileItem | null = profileContext.id
    ? {
        id: profileContext.id,
        name: profileContext.name || null,
        emails: profileContext.emails || [],
        primary_email: profileContext.primary_email || null,
        role: profileContext.role || null,
        active: profileContext.active ?? null,
        req_per_day: profileContext.req_per_day ?? null,
        last_login: profileContext.last_login || null,
        last_active: profileContext.last_active || null,
        created_at: profileContext.created_at || null,
        updated_at: profileContext.updated_at || null,
        primary_department_id: profileContext.primary_department_id || null,
      }
    : null;

  // Get profileId from profile context
  const profileId = profile?.id;

  // Check if user is a guest
  const isGuest = !profileId || profile?.role === "guest";

  return (
    <div className="space-y-6">
      <PracticeCustomize
        practiceData={practiceData}
        profile={profile}
        isGuest={isGuest}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  PracticeIn,
  PracticeOut,
};
