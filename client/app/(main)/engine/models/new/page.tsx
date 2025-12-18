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

/** ---- Strong types from OpenAPI ---- */
type ModelNewIn = InputOf<"/api/v3/models/new", "post">;
type ModelNewOut = OutputOf<"/api/v3/models/new", "post">;
type CreateModelIn = InputOf<"/api/v3/models/create", "post">;
type CreateModelOut = OutputOf<"/api/v3/models/create", "post">;

/** ---- Direct fetch for default model data (provider mapping for picker) ---- */
const getModelDetailDefault = async (): Promise<ModelNewOut> => {
  return api.post(
    "/models/new",
    { body: {} },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
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

/** ---- Server renders client with typed data and actions ---- */
export default async function NewModelPage() {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch default model data (provider mapping for picker)
  const modelDetailDefault = await getModelDetailDefault();

  return (
    <div className="space-y-6">
      <Model
        modelDetailDefault={modelDetailDefault}
        createModelAction={createModel}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { CreateModelIn, CreateModelOut, ModelNewIn, ModelNewOut };
