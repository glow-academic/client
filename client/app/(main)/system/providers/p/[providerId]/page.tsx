/**
 * app/(main)/system/providers/p/[providerId]/page.tsx
 * Provider edit page for the provider.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { auth } from "@/auth";
import Provider from "@/components/providers/Provider";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type ProviderDetailIn = InputOf<"/api/v3/providers/detail", "post">;
type ProviderDetailOut = OutputOf<"/api/v3/providers/detail", "post">;

type UpdateProviderIn = InputOf<"/api/v3/providers/update", "post">;
type UpdateProviderOut = OutputOf<"/api/v3/providers/update", "post">;

type DecryptProviderKeyIn = InputOf<"/api/v3/providers/decrypt-key", "post">;
type DecryptProviderKeyOut = OutputOf<"/api/v3/providers/decrypt-key", "post">;

type CreateProviderIn = InputOf<"/api/v3/providers/create", "post">;
type CreateProviderOut = OutputOf<"/api/v3/providers/create", "post">;

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getProvider = cache(
  async (input: ProviderDetailIn): Promise<ProviderDetailOut> => {
    return api.post("/providers/detail", input);
  },
);

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ providerId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { providerId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  try {
    const provider = await getProvider({
      body: { providerId, profileId },
    });
    return {
      title: `${provider?.name || "Provider"}`,
      description:
        provider?.description ||
        `Manage individual AI providers in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Provider",
      description: `Manage individual AI providers in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function updateProvider(
  input: UpdateProviderIn,
): Promise<UpdateProviderOut> {
  "use server";
  const out = await api.post("/providers/update", input);
  revalidateTag("providers");
  return out;
}

export async function decryptProviderKey(
  input: DecryptProviderKeyIn,
): Promise<DecryptProviderKeyOut> {
  "use server";
  const out = await api.post("/providers/decrypt-key", input);
  return out;
}

export async function createProvider(
  input: CreateProviderIn,
): Promise<CreateProviderOut> {
  "use server";
  const out = await api.post("/providers/create", input);
  revalidateTag("providers");
  return out;
}

/** ---- Server renders client with typed data and actions ---- */
export default async function ProviderEditPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  // Fetch provider detail (cached, won't duplicate with metadata)
  const providerDetail = await getProvider({
    body: { providerId, profileId },
  });

  return (
    <div className="space-y-6">
      <Provider
        providerId={providerId}
        providerDetail={providerDetail}
        updateProviderAction={updateProvider}
        decryptProviderKeyAction={decryptProviderKey}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateProviderIn,
  CreateProviderOut,
  DecryptProviderKeyIn,
  DecryptProviderKeyOut,
  ProviderDetailIn,
  ProviderDetailOut,
  UpdateProviderIn,
  UpdateProviderOut,
};
