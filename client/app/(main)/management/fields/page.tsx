/**
 * app/(main)/management/fields/page.tsx
 * Fields list page
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import { getSession } from "@/auth";

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
    title: "Fields",
    description: `Manage fields in GLOW${orgPart}.`,
  };
}

export default function FieldsPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Fields</h1>
        <p className="text-muted-foreground mt-2">
          Manage fields configuration
        </p>
      </div>
      <div className="rounded-lg border p-6">
        <p className="text-muted-foreground">Fields management coming soon...</p>
      </div>
    </div>
  );
}

