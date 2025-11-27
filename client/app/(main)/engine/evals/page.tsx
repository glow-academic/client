/**
 * app/(main)/engine/evals/page.tsx
 * Evals list page
 * @AshokSaravanan222
 * 01/26/2025
 */
import { getSession } from "@/auth";

import Evals from "@/components/evals/Evals";
import { api } from "@/lib/api/client";
import type { Metadata } from "next";

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
    title: "Evals",
    description: `Manage evals in GLOW${orgPart}.`,
  };
}

export default async function EvalsPage() {
  return (
    <div className="space-y-6" data-page="evals-index">
      <Evals />
    </div>
  );
}

