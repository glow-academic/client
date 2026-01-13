/**
 * app/(main)/management/fields/new/page.tsx
 * New field page - uses unified get/save endpoints
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */

import Field from "@/components/fields/Field";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetFieldIn = InputOf<"/api/v4/fields/get", "post">;
type GetFieldOut = OutputOf<"/api/v4/fields/get", "post">;
type SaveFieldIn = InputOf<"/api/v4/fields/save", "post">;
type SaveFieldOut = OutputOf<"/api/v4/fields/save", "post">;
type PatchFieldDraftIn = InputOf<"/api/v4/fields/draft", "patch">;
type PatchFieldDraftOut = OutputOf<"/api/v4/fields/draft", "patch">;

/** ---- Direct fetch for default field data with timeout ---- */
const getFieldDefault = async (input: GetFieldIn): Promise<GetFieldOut> => {
  // profileId comes from X-Profile-Id header (auto-injected)
  // Use timeout wrapper for robust API calls
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const result = await api.post("/fields/get", input, {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timeout - please try again");
    }
    throw error;
  }
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
async function saveField(input: SaveFieldIn): Promise<SaveFieldOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Use timeout wrapper for robust API calls
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const result = await api.post("/fields/save", input, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timeout - please try again");
    }
    throw error;
  }
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
  // profileId comes from X-Profile-Id header (auto-injected)

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

  // Fetch default field data with draft_id (field_id = null for new mode)
  const input: GetFieldIn = {
    body: {
      field_id: null, // NULL for new mode
      draft_id: q.draftId ?? null,
    } as GetFieldIn["body"],
  };
  const fieldData = await getFieldDefault(input);

  return (
    <div className="space-y-6">
      <Field
        key={q.draftId || "no-draft"} // Force remount when draftId changes
        fieldData={fieldData}
        saveFieldAction={saveField}
        patchFieldDraftAction={patchFieldDraft}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  GetFieldIn,
  GetFieldOut,
  PatchFieldDraftIn,
  PatchFieldDraftOut,
  SaveFieldIn,
  SaveFieldOut,
};
