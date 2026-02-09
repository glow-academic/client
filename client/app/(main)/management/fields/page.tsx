/**
 * app/(main)/management/fields/page.tsx
 * Fields list page
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */
import Fields from "@/components/fields/Fields";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type FieldsListOut = OutputOf<"/api/v4/artifacts/fields/list", "post">;
type DuplicateFieldIn = InputOf<"/api/v4/artifacts/fields/duplicate", "post">;
type DuplicateFieldOut = OutputOf<"/api/v4/artifacts/fields/duplicate", "post">;
type DeleteFieldIn = InputOf<"/api/v4/artifacts/fields/delete", "post">;
type DeleteFieldOut = OutputOf<"/api/v4/artifacts/fields/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ---- */
const getFieldsList = async (): Promise<FieldsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/artifacts/fields/list",
    { body: {} },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    },
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function duplicateField(
  input: DuplicateFieldIn,
): Promise<DuplicateFieldOut> {
  "use server";
  return api.post("/artifacts/fields/duplicate", input);
}

async function deleteField(input: DeleteFieldIn): Promise<DeleteFieldOut> {
  "use server";
  return api.post("/artifacts/fields/delete", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Fields",
    description:
      "Manage custom fields and data configuration for teaching assistant training platform. Configure custom field definitions to track additional educational data, assessment criteria, and learning metrics for comprehensive L&D program management.",
  };
}

export default async function FieldsPage() {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch list data server-side
  const listData = await getFieldsList();

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
