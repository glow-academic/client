/**
 * app/(main)/management/fields/page.tsx
 * Fields list page
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */
import { getSession } from "@/auth";

import Fields from "@/components/fields/Fields";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type FieldsListOut = OutputOf<"/api/v3/fields/list", "post">;
type DuplicateFieldIn = InputOf<"/api/v3/fields/duplicate", "post">;
type DuplicateFieldOut = OutputOf<"/api/v3/fields/duplicate", "post">;
type DeleteFieldIn = InputOf<"/api/v3/fields/delete", "post">;
type DeleteFieldOut = OutputOf<"/api/v3/fields/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ---- */
const getFieldsList = async (
  profileId: string
): Promise<FieldsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/fields/list",
    { body: { profileId } },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    }
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function duplicateField(
  input: DuplicateFieldIn,
): Promise<DuplicateFieldOut> {
  "use server";
  return api.post("/fields/duplicate", input);
}

async function deleteField(
  input: DeleteFieldIn,
): Promise<DeleteFieldOut> {
  "use server";
  return api.post("/fields/delete", input);
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
    title: "Fields",
    description: `Manage fields in GLOW${orgPart}.`,
  };
}

export default async function FieldsPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getFieldsList(profileId);

  return (
    <div className="space-y-6" data-page="fields-index">
      <Fields
        listData={listData}
        duplicateFieldAction={duplicateField}
        deleteFieldAction={deleteField}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  FieldsListOut,
  DeleteFieldIn,
  DeleteFieldOut,
  DuplicateFieldIn,
  DuplicateFieldOut,
};
