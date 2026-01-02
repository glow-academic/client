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
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type FieldNewIn = InputOf<"/api/v4/fields/new", "post">;
type FieldNewOut = OutputOf<"/api/v4/fields/new", "post">;
type CreateFieldIn = InputOf<"/api/v4/fields/create", "post">;
type CreateFieldOut = OutputOf<"/api/v4/fields/create", "post">;
type PatchFieldDraftIn = InputOf<"/api/v4/fields/draft", "patch">;
type PatchFieldDraftOut = OutputOf<"/api/v4/fields/draft", "patch">;

/** ---- Direct fetch for default field data ---- */
const getFieldDetailDefault = async (
  input: FieldNewIn
): Promise<FieldNewOut> => {
  // profileId removed - comes from X-Profile-Id header (auto-injected)
  return api.post(
    "/fields/new",
    input,
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

async function patchFieldDraft(
  input: PatchFieldDraftIn
): Promise<PatchFieldDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/fields/draft", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function NewFieldPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Access control is handled server-side in layout
  // profileId removed - comes from X-Profile-Id header (auto-injected)
  
  // Parse search params using nuqs
  const params = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
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

  // Fetch default field data with draft_id
  const input: FieldNewIn = {
    body: {
      draft_id: q.draftId ?? null,
    } as FieldNewIn["body"],
  };
  const fieldDetailDefault = await getFieldDetailDefault(input);

  return (
    <div className="space-y-6">
      <Field
        key={q.draftId || "no-draft"} // Force remount when draftId changes
        fieldDetailDefault={fieldDetailDefault}
        createFieldAction={createField}
        patchFieldDraftAction={patchFieldDraft}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateFieldIn,
  CreateFieldOut,
  FieldNewIn,
  FieldNewOut,
  PatchFieldDraftIn,
  PatchFieldDraftOut,
};
