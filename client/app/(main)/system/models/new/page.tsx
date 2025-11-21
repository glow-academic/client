/**
 * app/(main)/system/models/new/page.tsx
 * New model page
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";

import Model from "@/components/models/Model";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type ModelDetailDefaultIn = InputOf<"/api/v3/models/detail-default", "post">;
type ModelDetailDefaultOut = OutputOf<"/api/v3/models/detail-default", "post">;
type CreateModelIn = InputOf<"/api/v3/models/create", "post">;
type CreateModelOut = OutputOf<"/api/v3/models/create", "post">;

/** ---- Direct fetch for default model data (provider mapping for picker) ---- */
const getModelDetailDefault = async (
  profileId: string
): Promise<ModelDetailDefaultOut> => {
  return api.post(
    "/models/detail-default",
    { body: { profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Metadata ---- */
export const metadata: Metadata = {
  title: "Create Model",
  description: `Create a new AI model in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createModel(
  input: CreateModelIn,
): Promise<CreateModelOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/models/create", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function NewModelPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch default model data (provider mapping for picker)
  const modelDetailDefault = await getModelDetailDefault(profileId);

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
export type {
  CreateModelIn,
  CreateModelOut,
  ModelDetailDefaultIn,
  ModelDetailDefaultOut,
};

