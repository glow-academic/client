/**
 * app/(main)/system/feedback/page.tsx
 * Feedback list page - redirects to home with feedback section
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */

import { getSession } from "@/auth";

import Feedback from "@/components/feedback/Feedback";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type FeedbackListIn = InputOf<"/api/v3/feedback/list", "post">;
type FeedbackListOut = OutputOf<"/api/v3/feedback/list", "post">;
type BulkDeleteFeedbackIn = InputOf<"/api/v3/feedback/bulk-delete", "post">;
type BulkDeleteFeedbackOut = OutputOf<"/api/v3/feedback/bulk-delete", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getFeedbackList = cache(
  async (input: FeedbackListIn): Promise<FeedbackListOut> => {
    return api.post("/feedback/list", input);
  },
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function bulkDeleteFeedback(
  input: BulkDeleteFeedbackIn,
): Promise<BulkDeleteFeedbackOut> {
  "use server";
  const out = await api.post("/feedback/bulk-delete", input);
  // No revalidateTag needed - Redis cache handles invalidation
  return out;
}

export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";

  let organizationName = "";
  let organizationDescription = "";
  try {
    const activeSettings = await api.post("/settings/active", {
      body: { profileId },
    });
    organizationName = activeSettings.organization_name || "";
    organizationDescription = activeSettings.organization_description || "";
  } catch {
    // If settings unavailable, organizationName and organizationDescription will be empty
  }

  const orgPart = organizationName
    ? ` at ${organizationName}${organizationDescription ? ` - ${organizationDescription}` : ""}`
    : "";

  return {
    title: "Feedback",
    description: `Manage feedback in GLOW${orgPart}.`,
  };
}

export default async function FeedbackPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getFeedbackList({
    body: { profileId },
  });

  return (
    <div className="space-y-6">
      <Feedback
        listData={listData}
        bulkDeleteFeedbackAction={bulkDeleteFeedback}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  BulkDeleteFeedbackIn,
  BulkDeleteFeedbackOut,
  FeedbackListIn,
  FeedbackListOut,
};
