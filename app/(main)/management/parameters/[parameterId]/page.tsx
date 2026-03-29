/**
 * app/(main)/management/parameters/[parameterId]/page.tsx
 * Parameter edit page for the parameter page.
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Parameter from "@/components/artifacts/parameter/Parameter";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type ParameterGetIn = InputOf<"/parameters/get", "post">;
type ParameterGetOut = OutputOf<"/parameters/get", "post">;

type UpdateParameterIn = InputOf<"/parameters/update", "post">;
type UpdateParameterOut = OutputOf<"/parameters/update", "post">;

type PatchParameterDraftIn = InputOf<"/parameters/draft", "patch">;
type PatchParameterDraftOut = OutputOf<"/parameters/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v5/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v5/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<"/api/v5/resources/descriptions", "post">;
type CreateDraftDescriptionsOut = OutputOf<"/api/v5/resources/descriptions", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getParameter = async (
  input: ParameterGetIn
): Promise<ParameterGetOut> => {
  return api.post("/parameters/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/parameters/docs", "post">;
type DocsOut = OutputOf<"/parameters/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/parameters/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ parameterId: string }>;
}): Promise<Metadata> {
  const { parameterId } = await params;
  const docs = await getDocs({ body: { entity_id: parameterId } });
  return { title: docs.detail.title, description: docs.detail.description };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updateParameter(
  input: UpdateParameterIn
): Promise<UpdateParameterOut> {
  "use server";
  return api.post("/parameters/update", input);
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


/** ---- Server renders client with typed data and actions ---- */
export default async function ParameterEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ parameterId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { parameterId } = await params;
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

  // Inline server-side parsers for parameter search params
  const parameterSearchParams = {
    draftId: parseAsString,
    fieldSearch: parseAsString,
    fieldShowSelected: parseAsBoolean,
  };
  const loadParameterSearchParams = createLoader(parameterSearchParams);
  const q = loadParameterSearchParams(searchParamsObj);

  // Fetch parameter detail (always fresh - source of truth) with filter params
  try {
    const input: ParameterGetIn = {
      body: {
        parameter_id: parameterId,
        draft_id: q.draftId ?? null,
      } as ParameterGetIn["body"],
    };
    const [parameterDetail, docs, draftsResult] = await Promise.all([
      getParameter(input),
      getDocs({ body: { entity_id: parameterId } }),
      api.post("/parameters/drafts", {})
    ]);

    const entityName = docs.detail.title;

    return (
      <DraftProviderClient drafts={draftsResult.entries ?? []}>
        <PageHeader
          breadcrumbs={[
            { title: "Management", section: "management", url: "/management" },
            { title: "Parameters", section: "parameters", url: "/management/parameters" },
            { title: entityName },
          ]}
          toolbar={<SaveToolbar />}
        />
        <div
          className="space-y-6 px-4"
          data-page="parameter-edit"
          data-parameter-id={parameterId}
        >
          <Parameter
            parameterId={parameterId}
            mode="edit"
            parameterData={parameterDetail}
            updateParameterAction={updateParameter}
            patchParameterDraftAction={patchParameterDraft}
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
          resourceType="parameter"
          redirectPath="/management/parameters"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  PatchParameterDraftIn,
  PatchParameterDraftOut,
  ParameterGetIn,
  ParameterGetOut,
  UpdateParameterIn,
  UpdateParameterOut,
};
