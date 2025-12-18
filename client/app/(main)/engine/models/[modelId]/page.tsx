/**
 * app/(main)/engine/models/[modelId]/page.tsx
 * Model edit page
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Model from "@/components/models/Model";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { getSession } from "@/auth";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type ModelDetailIn = InputOf<"/api/v3/models/detail", "post">;
type ModelDetailOut = OutputOf<"/api/v3/models/detail", "post">;

type UpdateModelIn = InputOf<"/api/v3/models/update", "post">;
type UpdateModelOut = OutputOf<"/api/v3/models/update", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getModel = async (
  modelId: string,
  profileId: string,
): Promise<ModelDetailOut> => {
  return api.post(
    "/models/detail",
    { body: { modelId, profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ modelId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { modelId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (profileId) {
    try {
      const model = await getModel(modelId, profileId);
      return {
        title: `${model?.name || "Model"}`,
        description:
          model?.description ||
          `${model?.name ? `${model.name} - ` : ""}AI language model configuration for teaching assistant training simulations. Customize model settings to power realistic student personas and enhance simulation-based learning experiences.`,
      };
    } catch {
      // Fall through to default metadata
    }
  }

  return {
    title: "Model",
    description:
      "AI language model configuration for teaching assistant training simulations. Customize model settings to power realistic student personas and enhance simulation-based learning experiences.",
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updateModel(input: UpdateModelIn): Promise<UpdateModelOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId;
  if (!profileId) {
    throw new Error("Authentication required");
  }
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/models/update", {
    ...input,
    body: { ...input.body, profileId },
  });
}

/** ---- Server renders client with typed data and actions ---- */
export default async function ModelEditPage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  const { modelId } = await params;
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  // Fetch model data (always fresh - source of truth, includes provider_mapping)
  const model = await getModel(modelId, profileId);

  return (
    <div className="space-y-6" data-page="model-edit" data-model-id={modelId}>
      <Model
        modelId={modelId}
        modelDetail={model}
        updateModelAction={updateModel}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { ModelDetailIn, ModelDetailOut, UpdateModelIn, UpdateModelOut };
