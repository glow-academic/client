/**
 * app/(main)/management/parameters/new/page.tsx
 * New parameter page for the parameters section.
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import Parameter from "@/components/artifacts/parameter/Parameter";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type ParameterGetIn = InputOf<"/parameters/get", "post">;
type ParameterGetOut = OutputOf<"/parameters/get", "post">;
type CreateParameterIn = InputOf<"/parameters/create", "post">;
type CreateParameterOut = OutputOf<"/parameters/create", "post">;
type PatchParameterDraftIn = InputOf<"/parameters/draft", "patch">;
type PatchParameterDraftOut = OutputOf<"/parameters/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v5/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v5/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<"/api/v5/resources/descriptions", "post">;
type CreateDraftDescriptionsOut = OutputOf<"/api/v5/resources/descriptions", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getParameterDefault = async (
  input: ParameterGetIn
): Promise<ParameterGetOut> => {
  return api.post("/parameters/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createParameter(
  input: CreateParameterIn,
): Promise<CreateParameterOut> {
  "use server";
  return api.post("/parameters/create", input);
}


async function patchParameterDraft(input: PatchParameterDraftIn): Promise<PatchParameterDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/parameters/draft", input);
}

async function createNames(input: CreateDraftNamesIn): Promise<CreateDraftNamesOut> {
  "use server";
  return api.post("/resources/names", input);
}

async function createDescriptions(
  input: CreateDraftDescriptionsIn
): Promise<CreateDraftDescriptionsOut> {
  "use server";
  return api.post("/resources/descriptions", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/parameters/docs", "post">;
type DocsOut = OutputOf<"/parameters/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/parameters/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.new.title, description: docs.new.description };
}

export default async function NewParameterPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Access control is handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
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

  // Inline server-side parsers for parameter search params (navigation/search params only)
  const parameterSearchParams = {
    draftId: parseAsString,
    // Search/filter params
    fieldSearch: parseAsString,
    fieldShowSelected: parseAsBoolean,
  };
  const loadParameterSearchParams = createLoader(parameterSearchParams);
  const q = loadParameterSearchParams(searchParamsObj);

  // Fetch default parameter detail server-side with filter params and draft_id (parameter_id = null for new mode)
  const input: ParameterGetIn = {
    body: {
      parameter_id: null, // NULL for new mode
      draft_id: q.draftId ?? null,
    } as ParameterGetIn["body"],
  };
  const [parameterDetailDefault, draftsResult] = await Promise.all([
    getParameterDefault(input),
    api.post("/parameters/drafts", {})
  ]);

  return (
    <DraftProviderClient drafts={draftsResult.entries ?? []}>
      <PageHeader
        breadcrumbs={[
          { title: "Management", section: "management", url: "/management" },
          { title: "Parameters", section: "parameters", url: "/management/parameters" },
          { title: "New Parameter" },
        ]}
        toolbar={<SaveToolbar />}
      />
      <div className="space-y-6 px-4" data-page="parameter-new">
        <Parameter
          key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
          mode="create"
          parameterData={parameterDetailDefault}
          createParameterAction={createParameter}
          patchParameterDraftAction={patchParameterDraft}
          createNamesAction={createNames}
          createDescriptionsAction={createDescriptions}
        />
      </div>
    </DraftProviderClient>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  PatchParameterDraftIn,
  PatchParameterDraftOut,
  ParameterGetIn,
  ParameterGetOut,
  CreateParameterIn,
  CreateParameterOut,
};
