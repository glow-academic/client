/**
 * app/(main)/system/providers/p/[providerId]/page.tsx
 * Provider edit page for the provider.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";

import Provider from "@/components/providers/Provider";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidateTag, unstable_cache } from "next/cache";

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
const getProvider = (providerId: string) =>
  unstable_cache(
    async (profileId: string): Promise<ProviderDetailOut> => {
      return api.post("/providers/detail", {
        body: { providerId, profileId },
      });
    },
    ["providers:detail", providerId],
    { tags: ["providers", `provider:${providerId}`] }
  );

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ providerId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { providerId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  try {
    const provider = await getProvider(providerId)(profileId);
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
async function updateProvider(
  input: UpdateProviderIn
): Promise<UpdateProviderOut> {
  "use server";
  const out = await api.post("/providers/update", input);
  revalidateTag("providers");
  const providerId = input.body?.providerId;
  if (providerId) {
    revalidateTag(`provider:${providerId}`);
  }
  return out;
}

async function decryptProviderKey(
  input: DecryptProviderKeyIn
): Promise<DecryptProviderKeyOut> {
  "use server";
  const out = await api.post("/providers/decrypt-key", input);
  return out;
}

/** ---- Server renders client with typed data and actions ---- */
export default async function ProviderEditPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch provider detail (cached, won't duplicate with metadata)
  const providerDetail = await getProvider(providerId)(profileId);

  return (
    <div
      className="space-y-6"
      data-page="provider-edit"
      data-provider-id={providerId}
    >
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
