/**
 * app/(main)/management/fields/[fieldId]/page.tsx
 * Field edit page - uses unified get/save endpoints
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Field from "@/components/artifacts/field/Field";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetFieldIn = InputOf<"/fields/get", "post">;
type GetFieldOut = OutputOf<"/fields/get", "post">;
type UpdateFieldIn = InputOf<"/fields/update", "post">;
type UpdateFieldOut = OutputOf<"/fields/update", "post">;
type PatchFieldDraftIn = InputOf<"/fields/draft", "patch">;
type PatchFieldDraftOut = OutputOf<"/fields/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v5/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v5/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v5/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v5/resources/descriptions",
  "post"
>;

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

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/fields/docs", "post">;
type DocsOut = OutputOf<"/fields/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/fields/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ fieldId: string }>;
}): Promise<Metadata> {
  const { fieldId } = await params;
  const docs = await getDocs({ body: { entity_id: fieldId } });
  return { title: docs.detail.title, description: docs.detail.description };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updateField(input: UpdateFieldIn): Promise<UpdateFieldOut> {
  "use server";
  return api.post("/fields/update", input);
}

async function patchFieldDraft(
  input: PatchFieldDraftIn
): Promise<PatchFieldDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.patch("/fields/draft", input);
}

async function createNames(
  input: CreateDraftNamesIn
): Promise<CreateDraftNamesOut> {
  "use server";
  return api.post("/resources/names", input);
}

async function createDescriptions(
  input: CreateDraftDescriptionsIn
): Promise<CreateDraftDescriptionsOut> {
  "use server";
  return api.post("/resources/descriptions", input);
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
    conditionalParameterSearch: parseAsString,
    conditionalParameterShowSelected: parseAsBoolean,
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
        conditional_parameter_search: q.conditionalParameterSearch ?? null,
        conditional_parameter_show_selected:
          q.conditionalParameterShowSelected ?? null,
      } as GetFieldIn["body"],
    };
    const [fieldData, docs, draftsResult] = await Promise.all([
      getField(input),
      getDocs({ body: { entity_id: fieldId } }),
      api.post("/fields/drafts", {})
    ]);

    const entityName = docs.detail.title;

    return (
      <DraftProviderClient drafts={draftsResult.entries ?? []}>
        <PageHeader
          breadcrumbs={[
            { title: "Management", section: "management", url: "/management" },
            { title: "Fields", section: "fields", url: "/management/fields" },
            { title: entityName },
          ]}
          toolbar={<SaveToolbar />}
        />
        <div className="space-y-6 px-4" data-page="field-edit" data-field-id={fieldId}>
          <Field
            key={q.draftId || "no-draft"} // Force remount when draftId changes
            fieldId={fieldId}
            fieldData={fieldData}
            updateFieldAction={updateField}
            patchFieldDraftAction={patchFieldDraft}
            createNamesAction={createNames}
            createDescriptionsAction={createDescriptions}
          />
        </div>
      </DraftProviderClient>
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
  UpdateFieldIn,
  UpdateFieldOut,
};
