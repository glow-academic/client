/**
 * app/page.tsx
 * This is the homepage.
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
import { getSession } from "@/auth";

import Info from "@/components/home/Info";
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
    title: "GLOW",
    description: `GLOW${orgPart}.`,
  };
}

export default async function InfoPage() {
  const session = await getSession();
  // Check if user is logged in: effectiveProfileId exists and is not guest-profile-id
  const isLoggedIn =
    !!session?.effectiveProfileId &&
    session.effectiveProfileId !== "guest-profile-id";

  return <Info isLoggedIn={isLoggedIn} />;
}
