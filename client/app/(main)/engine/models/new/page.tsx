/**
 * app/(main)/engine/models/new/page.tsx
 * New model page
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Model from "@/components/models/Model";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type ModelNewIn = InputOf<"/api/v4/models/new", "post">;
type ModelNewOut = OutputOf<"/api/v4/models/new", "post">;
type CreateModelIn = InputOf<"/api/v4/models/create", "post">;
type CreateModelOut = OutputOf<"/api/v4/models/create", "post">;
type PatchModelDraftIn = InputOf<"/api/v4/models/draft", "patch">;
type PatchModelDraftOut = OutputOf<"/api/v4/models/draft", "patch">;

/** ---- Direct fetch for default model data (provider mapping for picker) ---- */
const getModelDetailDefault = async (
  input: ModelNewIn
): Promise<ModelNewOut> => {
  return api.post("/models/new", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Create Model",
    description:
      "Create a new AI language model configuration for teaching assistant training simulations. Set up custom models to power realistic student personas and enhance simulation-based learning experiences for pedagogical development.",
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createModel(input: CreateModelIn): Promise<CreateModelOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/models/create", input);
}

async function patchModelDraft(
  input: PatchModelDraftIn
): Promise<PatchModelDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/models/draft", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function NewModelPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Access control handled server-side in layout
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

  // Inline server-side parsers for model search params (draftId only)
  const modelSearchParams = {
    draftId: parseAsString,
  };
  const loadModelSearchParams = createLoader(modelSearchParams);
  const q = loadModelSearchParams(searchParamsObj);

  // Fetch default model data with draft_id
  const input: ModelNewIn = {
    body: {
      draft_id: q.draftId ?? null,
    },
  };
  const modelDetailDefault = await getModelDetailDefault(input);

  return (
    <div className="space-y-6">
      <Model
        modelDetailDefault={modelDetailDefault}
        createModelAction={createModel}
        patchModelDraftAction={patchModelDraft}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateModelIn,
  CreateModelOut,
  ModelNewIn,
  ModelNewOut,
  PatchModelDraftIn,
  PatchModelDraftOut,
};
