/**
 * app/(main)/management/fields/new/page.tsx
 * New field page - uses unified get/save endpoints
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */

import Field from "@/components/artifacts/field/Field";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import { getDrafts, resolveGroupId } from "@/app/(main)/layout-server";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetFieldIn = InputOf<"/api/v5/artifacts/fields/get", "post">;
type GetFieldOut = OutputOf<"/api/v5/artifacts/fields/get", "post">;
type CreateFieldIn = InputOf<"/api/v5/artifacts/fields/create", "post">;
type CreateFieldOut = OutputOf<"/api/v5/artifacts/fields/create", "post">;
type PatchFieldDraftIn = InputOf<"/api/v5/artifacts/fields/draft", "patch">;
type PatchFieldDraftOut = OutputOf<"/api/v5/artifacts/fields/draft", "patch">;
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

/** ---- Direct fetch for default field data with timeout ---- */
const getFieldDefault = async (input: GetFieldIn): Promise<GetFieldOut> => {
  // profileId comes from X-Profile-Id header (auto-injected)
  // Use timeout wrapper for robust API calls
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const result = await api.post("/artifacts/fields/get", input, {
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
/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v5/artifacts/fields/docs", "post">;
type DocsOut = OutputOf<"/api/v5/artifacts/fields/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/fields/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.new.title, description: docs.new.description };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createField(input: CreateFieldIn): Promise<CreateFieldOut> {
  "use server";
  return api.post("/artifacts/fields/create", input);
}

async function patchFieldDraft(
  input: PatchFieldDraftIn
): Promise<PatchFieldDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.patch("/artifacts/fields/draft", input);
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
    descriptionSearch: parseAsString,
    conditionalParameterSearch: parseAsString,
    conditionalParameterShowSelected: parseAsBoolean,
  };
  const loadFieldSearchParams = createLoader(fieldSearchParams);
  const q = loadFieldSearchParams(searchParamsObj);

  // Resolve group_id from layout context (cached per request)
  const groupId = (await resolveGroupId({ draft_id: q.draftId ?? null, artifact_type: "field" })).group_id;

  // Fetch default field data with draft_id (field_id = null for new mode)
  const input: GetFieldIn = {
    body: {
      field_id: null, // NULL for new mode
      draft_id: q.draftId ?? null,
      group_id: groupId,
      description_search: q.descriptionSearch ?? null,
      conditional_parameter_search: q.conditionalParameterSearch ?? null,
      conditional_parameter_show_selected:
        q.conditionalParameterShowSelected ?? null,
    } as GetFieldIn["body"],
  };
  const [fieldData, draftsResult] = await Promise.all([
    getFieldDefault(input),
    getDrafts(), // TODO: fetch only field drafts (e.g. getDrafts({ artifact_type: "field" }))
  ]);

  return (
    <DraftProviderClient drafts={draftsResult.drafts ?? []}>
      <PageHeader
        breadcrumbs={[
          { title: "Management", section: "management", url: "/management" },
          { title: "Fields", section: "fields", url: "/management/fields" },
          { title: "New Field" },
        ]}
        toolbar={<SaveToolbar artifactType="field" />}
      />
      <div className="space-y-6 px-4">
        <Field
          key={q.draftId || "no-draft"} // Force remount when draftId changes
          fieldData={fieldData}
          createFieldAction={createField}
          patchFieldDraftAction={patchFieldDraft}
          createNamesAction={createNames}
          createDescriptionsAction={createDescriptions}
        />
      </div>
    </DraftProviderClient>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  GetFieldIn,
  GetFieldOut,
  PatchFieldDraftIn,
  PatchFieldDraftOut,
  CreateFieldIn,
  CreateFieldOut,
};
