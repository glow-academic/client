/**
 * app/(main)/management/parameters/p/[parameterId]/page.tsx
 * Parameter edit page for the parameter page.
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Parameter from "@/components/parameters/Parameter";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type ParameterGetIn = InputOf<"/api/v4/artifacts/parameters/get", "post">;
type ParameterGetOut = OutputOf<"/api/v4/artifacts/parameters/get", "post">;

type SaveParameterIn = InputOf<"/api/v4/artifacts/parameters/save", "post">;
type SaveParameterOut = OutputOf<"/api/v4/artifacts/parameters/save", "post">;

type PatchParameterDraftIn = InputOf<"/api/v4/artifacts/parameters/draft", "patch">;
type PatchParameterDraftOut = OutputOf<"/api/v4/artifacts/parameters/draft", "patch">;

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

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ parameterId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { parameterId } = await params;
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const input: ParameterGetIn = {
      body: {
        parameter_id: parameterId,
        draft_id: null,
      } as ParameterGetIn["body"],
    };
    const parameter = await getParameter(input);
    return {
      title: `${parameter?.name || "Parameter"} Parameter`,
      description: `${parameter?.name ? `${parameter.name} - ` : ""}System parameter configuration for teaching assistant training platform.${parameter?.description ? ` ${parameter.description}` : ""} Manage platform-wide settings and learning environment configurations for effective L&D program administration.`,
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Parameter",
    description:
      "System parameter configuration for teaching assistant training platform. Manage platform-wide settings and learning environment configurations for effective L&D program administration.",
  };
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
