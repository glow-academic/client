/**
 * app/(main)/management/fields/[fieldId]/page.tsx
 * Field edit page
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */

import Field from "@/components/fields/Field";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { getSession } from "@/auth";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type FieldDetailIn = InputOf<"/api/v3/fields/detail", "post">;
type FieldDetailOut = OutputOf<"/api/v3/fields/detail", "post">;

type UpdateFieldIn = InputOf<"/api/v3/fields/update", "post">;
type UpdateFieldOut = OutputOf<"/api/v3/fields/update", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getField = async (
  fieldId: string,
  profileId: string,
): Promise<FieldDetailOut> => {
  return api.post(
    "/fields/detail",
    { body: { fieldId, profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ fieldId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { fieldId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (profileId) {
    try {
      const field = await getField(fieldId, profileId);
      return {
        title: `${field?.name || "Field"}`,
        description:
          field?.description ||
          `${field?.name ? `${field.name} - ` : ""}Custom field configuration for teaching assistant training platform. Manage field definitions to track additional educational data, assessment criteria, and learning metrics.`,
      };
    } catch {
      // Fall through to default metadata
    }
  }

  return {
    title: "Field",
    description:
      "Custom field configuration for teaching assistant training platform. Manage field definitions to track additional educational data, assessment criteria, and learning metrics.",
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updateField(input: UpdateFieldIn): Promise<UpdateFieldOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId;
  if (!profileId) {
    throw new Error("Authentication required");
  }
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
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

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
export type { FieldDetailIn, FieldDetailOut, UpdateFieldIn, UpdateFieldOut };
