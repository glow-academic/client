/**
 * app/(main)/management/fields/new/page.tsx
 * New field page
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */

import Field from "@/components/fields/Field";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type FieldNewIn = InputOf<"/api/v3/fields/new", "post">;
type FieldNewOut = OutputOf<"/api/v3/fields/new", "post">;
type CreateFieldIn = InputOf<"/api/v3/fields/create", "post">;
type CreateFieldOut = OutputOf<"/api/v3/fields/create", "post">;

/** ---- Direct fetch for default field data ---- */
const getFieldDetailDefault = async (): Promise<FieldNewOut> => {
  // profileId removed - comes from X-Profile-Id header (auto-injected)
  return api.post(
    "/fields/new",
    { body: {} },
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
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/fields/create", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function NewFieldPage() {
  // Access control is handled server-side in layout
  // profileId removed - comes from X-Profile-Id header (auto-injected)

  // Fetch default field data
  const fieldDetailDefault = await getFieldDetailDefault();

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
