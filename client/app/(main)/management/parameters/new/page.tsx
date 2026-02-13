/**
 * app/(main)/management/parameters/new/page.tsx
 * New parameter page for the parameters section.
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import Parameter from "@/components/artifacts/parameter/Parameter";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type ParameterGetIn = InputOf<"/api/v4/artifacts/parameters/get", "post">;
type ParameterGetOut = OutputOf<"/api/v4/artifacts/parameters/get", "post">;
type SaveParameterIn = InputOf<"/api/v4/artifacts/parameters/save", "post">;
type SaveParameterOut = OutputOf<"/api/v4/artifacts/parameters/save", "post">;
type PatchParameterDraftIn = InputOf<"/api/v4/artifacts/parameters/draft", "patch">;
type PatchParameterDraftOut = OutputOf<"/api/v4/artifacts/parameters/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<"/api/v4/resources/descriptions", "post">;
type CreateDraftDescriptionsOut = OutputOf<"/api/v4/resources/descriptions", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getParameterDefault = async (
  input: ParameterGetIn
): Promise<ParameterGetOut> => {
  return api.post("/artifacts/parameters/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function saveParameter(
  input: SaveParameterIn,
): Promise<SaveParameterOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/parameters/save", input);
}


async function patchParameterDraft(input: PatchParameterDraftIn): Promise<PatchParameterDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/artifacts/parameters/draft", input);
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
type DocsIn = InputOf<"/api/v4/artifacts/parameters/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/parameters/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/parameters/docs", input);
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
  const parameterDetailDefault = await getParameterDefault(input);

  return (
    <div className="space-y-6" data-page="parameter-new">
      <Parameter
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        mode="create"
        parameterData={parameterDetailDefault}
        saveParameterAction={saveParameter}
        patchParameterDraftAction={patchParameterDraft}
        createNamesAction={createNames}
        createDescriptionsAction={createDescriptions}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  PatchParameterDraftIn,
  PatchParameterDraftOut,
  ParameterGetIn,
  ParameterGetOut,
  SaveParameterIn,
  SaveParameterOut,
};
