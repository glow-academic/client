/**
 * app/(main)/management/fields/[fieldId]/page.tsx
 * Field edit page - uses unified get/save endpoints
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Field from "@/components/fields/Field";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetFieldIn = InputOf<"/api/v4/fields/get", "post">;
type GetFieldOut = OutputOf<"/api/v4/fields/get", "post">;
type SaveFieldIn = InputOf<"/api/v4/fields/save", "post">;
type SaveFieldOut = OutputOf<"/api/v4/fields/save", "post">;
type PatchFieldDraftIn = InputOf<"/api/v4/fields/draft", "patch">;
type PatchFieldDraftOut = OutputOf<"/api/v4/fields/draft", "patch">;

/** ---- Direct fetch (no caching - source of truth) with timeout ---- */
const getField = async (input: GetFieldIn): Promise<GetFieldOut> => {
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

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ fieldId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { fieldId } = await params;
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const input: GetFieldIn = {
      body: {
        field_id: fieldId,
        draft_id: null,
      } as GetFieldIn["body"],
    };
    const field = await getField(input);
    const fieldName = field?.resources?.current?.names?.[0]?.name ?? null;
    const fieldDescription =
      field?.resources?.current?.descriptions?.[0]?.description ?? null;
    return {
      title: `${fieldName || "Field"}`,
      description:
        fieldDescription ||
        `${fieldName ? `${fieldName} - ` : ""}Custom field configuration for teaching assistant training platform. Manage field definitions to track additional educational data, assessment criteria, and learning metrics.`,
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
  // No revalidateTag needed - Redis cache handles invalidation
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
    descriptionSearch: parseAsString,
    parameterSearch: parseAsString,
    parameterShowSelected: parseAsBoolean,
  };
  const loadFieldSearchParams = createLoader(fieldSearchParams);
  const q = loadFieldSearchParams(searchParamsObj);

  // Fetch field data (always fresh - source of truth) with draft_id
  try {
    const input: GetFieldIn = {
      body: {
        field_id: fieldId,
        draft_id: q.draftId ?? null,
        description_search: q.descriptionSearch ?? null,
        parameter_search: q.parameterSearch ?? null,
        parameter_show_selected: q.parameterShowSelected ?? null,
      } as GetFieldIn["body"],
    };
    const fieldData = await getField(input);

    return (
      <div className="space-y-6" data-page="field-edit" data-field-id={fieldId}>
        <Field
          key={q.draftId || "no-draft"} // Force remount when draftId changes
          fieldId={fieldId}
          fieldData={fieldData}
          saveFieldAction={saveField}
          patchFieldDraftAction={patchFieldDraft}
        />
      </div>
    );
  } catch (error: unknown) {
    // Check if it's a 403 error (department access denied)
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 403
    ) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="field"
          redirectPath="/management/fields"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
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
