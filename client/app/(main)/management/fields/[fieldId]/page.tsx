/**
 * app/(main)/management/fields/[fieldId]/page.tsx
 * Field edit page
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */

import { getSession } from "@/auth";

import Field from "@/components/fields/Field";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type FieldDetailIn = InputOf<"/api/v3/fields/detail", "post">;
type FieldDetailOut = OutputOf<"/api/v3/fields/detail", "post">;

type UpdateFieldIn = InputOf<"/api/v3/fields/update", "post">;
type UpdateFieldOut = OutputOf<"/api/v3/fields/update", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getField = async (
  fieldId: string,
  profileId: string
): Promise<FieldDetailOut> => {
  return api.post(
    "/fields/detail",
    { body: { fieldId, profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ fieldId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { fieldId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

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

  try {
    const field = await getField(fieldId, profileId);
    return {
      title: `${field?.name || "Field"}`,
      description:
        field?.description ||
        `Manage field in GLOW${orgPart}.`,
    };
  } catch {
    return {
      title: "Field",
      description: `Manage field in GLOW${orgPart}.`,
    };
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updateField(input: UpdateFieldIn): Promise<UpdateFieldOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  return api.post("/fields/update", {
    ...input,
    body: { ...input.body, profileId },
  });
}

/** ---- Server renders client with typed data and actions ---- */
export default async function FieldEditPage({
  params,
}: {
  params: Promise<{ fieldId: string }>;
}) {
  const { fieldId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch field data (always fresh - source of truth)
  const field = await getField(fieldId, profileId);

  return (
    <div className="space-y-6" data-page="field-edit" data-field-id={fieldId}>
      <Field
        fieldId={fieldId}
        fieldDetail={field}
        updateFieldAction={updateField}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  FieldDetailIn,
  FieldDetailOut,
  UpdateFieldIn,
  UpdateFieldOut,
};

