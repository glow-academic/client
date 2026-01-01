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
import { getLayoutContext } from "../../layout-server";

/** ---- Strong types from OpenAPI ---- */
type PracticeIn = InputOf<"/api/v4/practice/overview", "post">;
type PracticeOut = OutputOf<"/api/v4/practice/overview", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Practice overview responses can get large and exceed Next.js 2MB cache limit.
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getPractice = async (input: PracticeIn): Promise<PracticeOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/practice/overview", input, {
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

export default async function PracticeCustomPage() {
  // Access control handled server-side in layout
  // Practice page allows guest role users (authenticated users with guest role)
  // profileIds come from X-Profile-Id header (auto-injected by request-core.ts) or cookies

  // Get profileId and departmentIds from profile context with resolved UUIDs
  // Use cached layout context (reuses data already fetched by layout)
  // profileIds come from X-Profile-Id header (auto-injected by request-core.ts) or cookies
  let profileContext;
  try {
    profileContext = await getLayoutContext({
      body: {
        pathname: "/practice/custom",
      },
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

  // Build practice filters (only departmentIds)
  // profileId removed - comes from X-Profile-Id header automatically
  // Always pass departmentIds (never empty array) - use all IDs from profile context
  const practiceFiltersBody: PracticeIn["body"] = {
    departmentIds: profileContext.departmentIds || [], // Always pass (non-empty from profile context)
  };

  const practiceFilters: PracticeIn = {
    body: practiceFiltersBody,
  };

  // Fetch practice data server-side
  const practiceData = await getPractice(practiceFilters);

  // Get effectiveProfileId from profile context
  const effectiveProfileId = profileContext.effectiveProfile?.id;

  // Check if user is a guest
  const isGuest =
    !effectiveProfileId || profileContext.effectiveProfile?.role === "guest";

  return (
    <div className="space-y-6">
      <PracticeCustomize
        practiceData={practiceData}
        effectiveProfile={profileContext.effectiveProfile}
        activeProfile={profileContext.actualProfile}
        isGuest={isGuest}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PracticeIn, PracticeOut };
