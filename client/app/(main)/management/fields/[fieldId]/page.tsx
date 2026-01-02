/**
 * app/(main)/management/fields/[fieldId]/page.tsx
 * Field edit page
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */

import Field from "@/components/fields/Field";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type FieldDetailIn = InputOf<"/api/v4/fields/detail", "post">;
type FieldDetailOut = OutputOf<"/api/v4/fields/detail", "post">;

type UpdateFieldIn = InputOf<"/api/v4/fields/update", "post">;
type UpdateFieldOut = OutputOf<"/api/v4/fields/update", "post">;
type PatchFieldDraftIn = InputOf<"/api/v4/fields/draft", "patch">;
type PatchFieldDraftOut = OutputOf<"/api/v4/fields/draft", "patch">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getField = async (
  input: FieldDetailIn
): Promise<FieldDetailOut> => {
  return api.post(
    "/fields/detail",
    input,
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
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const input: FieldDetailIn = {
      body: {
        field_id: fieldId,
        draft_id: null,
      } as FieldDetailIn["body"],
    };
    const field = await getField(input);
    return {
      title: `${field?.name || "Field"}`,
      description:
        field?.description ||
        `${field?.name ? `${field.name} - ` : ""}Custom field configuration for teaching assistant training platform. Manage field definitions to track additional educational data, assessment criteria, and learning metrics.`,
    };
  } catch {
    // Fall through to default metadata
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
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/fields/update", input);
}

async function patchFieldDraft(
  input: PatchFieldDraftIn
): Promise<PatchFieldDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/fields/draft", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function FieldEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ fieldId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { fieldId } = await params;
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  
  // Parse search params using nuqs
  const paramsObj = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(paramsObj).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Inline server-side parsers for field search params
  const fieldSearchParams = {
    draftId: parseAsString,
  };
  const loadFieldSearchParams = createLoader(fieldSearchParams);
  const q = loadFieldSearchParams(searchParamsObj);

  // Fetch field data (always fresh - source of truth) with draft_id
  const input: FieldDetailIn = {
    body: {
      field_id: fieldId,
      draft_id: q.draftId ?? null,
    } as FieldDetailIn["body"],
  };
  const field = await getField(input);

  return (
    <div className="space-y-6" data-page="field-edit" data-field-id={fieldId}>
      <Field
        key={q.draftId || "no-draft"} // Force remount when draftId changes
        fieldId={fieldId}
        fieldDetail={field}
        updateFieldAction={updateField}
        patchFieldDraftAction={patchFieldDraft}
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
  PatchFieldDraftIn,
  PatchFieldDraftOut,
};
