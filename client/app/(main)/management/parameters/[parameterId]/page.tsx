/**
 * app/(main)/management/parameters/[parameterId]/page.tsx
 * Parameter edit page for the parameter page.
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Parameter from "@/components/artifacts/parameter/Parameter";
import { resolveGroupId } from "@/app/(main)/layout-server";
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
const getParameter = async (
  input: ParameterGetIn
): Promise<ParameterGetOut> => {
  return api.post("/artifacts/parameters/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/parameters/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/parameters/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/parameters/docs", input);
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
async function saveParameter(
  input: SaveParameterIn
): Promise<SaveParameterOut> {
  "use server";
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

  const groupId = await resolveGroupId(q.draftId ?? null, "parameter");

  // Fetch parameter detail (always fresh - source of truth) with filter params
  try {
    const input: ParameterGetIn = {
      body: {
        parameter_id: parameterId,
        draft_id: q.draftId ?? null,
        group_id: groupId,
      } as ParameterGetIn["body"],
    };
    const parameterDetail = await getParameter(input);

    return (
      <div
        className="space-y-6"
        data-page="parameter-edit"
        data-parameter-id={parameterId}
      >
        <Parameter
          parameterId={parameterId}
          mode="edit"
          parameterData={parameterDetail}
          saveParameterAction={saveParameter}
          patchParameterDraftAction={patchParameterDraft}
          createNamesAction={createNames}
          createDescriptionsAction={createDescriptions}
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
  SaveParameterIn,
  SaveParameterOut,
};
