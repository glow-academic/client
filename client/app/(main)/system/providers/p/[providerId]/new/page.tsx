/**
 * app/(main)/system/providers/p/[providerId]/new/page.tsx
 * New model page for the providers section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { auth } from "@/auth";
import Model from "@/components/providers/Model";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type ProviderDetailIn = InputOf<"/api/v3/providers/detail", "post">;
type ProviderDetailOut = OutputOf<"/api/v3/providers/detail", "post">;
type CreateModelIn = InputOf<"/api/v3/providers/models/create", "post">;
type CreateModelOut = OutputOf<"/api/v3/providers/models/create", "post">;

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getProvider = cache(
  async (input: ProviderDetailIn): Promise<ProviderDetailOut> => {
    return api.post("/providers/detail", input);
  }
);

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ providerId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { providerId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  try {
    const provider = await getProvider({ body: { providerId, profileId } });
    return {
      title: `${provider?.name || "Provider"} Models`,
      description:
        provider?.description ||
        `Manage individual AI models for ${provider?.name} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Provider Models",
      description: `Manage individual AI models in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function createModel(
  input: CreateModelIn
): Promise<CreateModelOut> {
  "use server";
  const out = await api.post("/providers/models/create", input);
  revalidateTag("providers");
  return out;
}

/** ---- Server renders client with typed data and actions ---- */
export default async function NewModelPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  // Fetch provider detail server-side
  const providerDetail = await getProvider({ body: { providerId, profileId } });

  return (
    <div className="space-y-6">
      <Model
        providerId={providerId}
        providerDetail={providerDetail}
        createModelAction={createModel}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateModelIn,
  CreateModelOut,
  ProviderDetailIn,
  ProviderDetailOut,
};
