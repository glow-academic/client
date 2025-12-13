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
import { getSession } from "@/auth";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type FieldsListOut = OutputOf<"/api/v3/fields/list", "post">;
type DuplicateFieldIn = InputOf<"/api/v3/fields/duplicate", "post">;
type DuplicateFieldOut = OutputOf<"/api/v3/fields/duplicate", "post">;
type DeleteFieldIn = InputOf<"/api/v3/fields/delete", "post">;
type DeleteFieldOut = OutputOf<"/api/v3/fields/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ---- */
const getFieldsList = async (profileId: string): Promise<FieldsListOut> => {
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
    },
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function duplicateField(
  input: DuplicateFieldIn,
): Promise<DuplicateFieldOut> {
  "use server";
  return api.post("/fields/duplicate", input);
}

async function deleteField(input: DeleteFieldIn): Promise<DeleteFieldOut> {
  "use server";
  return api.post("/fields/delete", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Fields",
    description:
      "Manage custom fields and data configuration for teaching assistant training platform. Configure custom field definitions to track additional educational data, assessment criteria, and learning metrics for comprehensive L&D program management.",
  };
}

export default async function FieldsPage() {
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

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
