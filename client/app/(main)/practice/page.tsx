/**
 * app/(main)/practice/page.tsx
 * Practice page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";

import Practice from "@/components/practice/Practice";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type PracticeIn = InputOf<"/api/v3/practice", "post">;
type PracticeOut = OutputOf<"/api/v3/practice", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getPractice = cache(async (input: PracticeIn): Promise<PracticeOut> => {
  return api.post("/practice", input);
});

export const metadata: Metadata = {
  title: "Practice",
  description: `Practice page for GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function PracticePage() {
  const session = await getSession();

  // Get profileId and departmentIds from profile context
  const profileContext = await api.post("/profile/context", {
    body: {
      actualProfileId: session?.user?.profileId || "guest-profile-id",
      effectiveProfileId: session?.effectiveProfileId || "guest-profile-id",
      pathname: "/practice",
    },
  });

  // Build practice filters (only profileId and departmentIds)
  const practiceFiltersBody: PracticeIn["body"] = {
    profileId: session?.effectiveProfileId || "guest-profile-id",
  };

  // Only include departmentIds if they exist
  if (profileContext.departmentIds && profileContext.departmentIds.length > 0) {
    practiceFiltersBody.departmentIds = profileContext.departmentIds;
  }

  const practiceFilters: PracticeIn = {
    body: practiceFiltersBody,
  };

  // Fetch practice data server-side
  const practiceData = await getPractice(practiceFilters);

  return (
    <div className="space-y-6">
      <Practice practiceData={practiceData} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PracticeIn, PracticeOut };
