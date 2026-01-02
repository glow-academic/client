/**
 * app/(main)/management/parameters/new/page.tsx
 * New parameter page for the parameters section.
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import Parameter from "@/components/parameters/Parameter";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type ParameterNewIn = InputOf<"/api/v4/parameters/new", "post">;
type ParameterNewOut = OutputOf<"/api/v4/parameters/new", "post">;
type CreateParameterIn = InputOf<"/api/v4/parameters/create", "post">;
type CreateParameterOut = OutputOf<"/api/v4/parameters/create", "post">;
type UpdateParameterIn = InputOf<"/api/v4/parameters/update", "post">;
type UpdateParameterOut = OutputOf<"/api/v4/parameters/update", "post">;
type PatchParameterDraftIn = InputOf<"/api/v4/parameters/draft", "patch">;
type PatchParameterDraftOut = OutputOf<"/api/v4/parameters/draft", "patch">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getParameterDefault = async (
  input: ParameterNewIn
): Promise<ParameterNewOut> => {
  return api.post("/parameters/new", input, {
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
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/parameters/create", {
    ...input,
    body: { ...input.body },
  });
}

async function updateParameter(
  input: UpdateParameterIn,
): Promise<UpdateParameterOut> {
  "use server";
  // profileId removed - comes from X-Profile-Id header (auto-injected)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/parameters/update", input);
}

async function patchParameterDraft(
  input: PatchParameterDraftIn
): Promise<PatchParameterDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/parameters/draft", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Parameter",
    description:
      "Create a new system parameter for teaching assistant training platform. Configure platform-wide parameters, learning environment settings, and system-wide configurations for effective L&D program administration.",
  };
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

  // Fetch default parameter detail server-side with filter params and draft_id
  const input: ParameterNewIn = {
    body: {
      draft_id: q.draftId ?? null,
    } as ParameterNewIn["body"],
  };
  const parameterDetailDefault = await getParameterDefault(input);

  return (
    <div className="space-y-6" data-page="parameter-new">
      <Parameter
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        mode="create"
        parameterDetailDefault={parameterDetailDefault}
        createParameterAction={createParameter}
        updateParameterAction={updateParameter}
        patchParameterDraftAction={patchParameterDraft}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateParameterIn,
  CreateParameterOut,
  PatchParameterDraftIn,
  PatchParameterDraftOut,
  ParameterNewIn,
  ParameterNewOut,
  UpdateParameterIn,
  UpdateParameterOut,
};
