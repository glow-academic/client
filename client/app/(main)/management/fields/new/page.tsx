/**
 * app/(main)/management/fields/new/page.tsx
 * New field page
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */

import Field from "@/components/fields/Field";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { getSession } from "@/auth";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type FieldNewIn = InputOf<"/api/v3/fields/new", "post">;
type FieldNewOut = OutputOf<"/api/v3/fields/new", "post">;
type CreateFieldIn = InputOf<"/api/v3/fields/create", "post">;
type CreateFieldOut = OutputOf<"/api/v3/fields/create", "post">;

/** ---- Direct fetch for default field data ---- */
const getFieldDetailDefault = async (
  profileId: string,
): Promise<FieldNewOut> => {
  return api.post(
    "/fields/new",
    { body: { profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Create Field",
    description:
      "Create a new custom field for teaching assistant training platform. Define custom field configurations to track additional educational data, assessment criteria, and learning metrics for comprehensive L&D program management.",
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createField(input: CreateFieldIn): Promise<CreateFieldOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId;
  if (!profileId) {
    throw new Error("Authentication required");
  }
  return api.post("/fields/create", {
    ...input,
    body: { ...input.body, profileId },
  });
}

/** ---- Server renders client with typed data and actions ---- */
export default async function NewFieldPage() {
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  // Fetch default field data
  const fieldDetailDefault = await getFieldDetailDefault(profileId);

  return (
    <div className="space-y-6">
      <Field
        fieldDetailDefault={fieldDetailDefault}
        createFieldAction={createField}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { CreateFieldIn, CreateFieldOut, FieldNewIn, FieldNewOut };
