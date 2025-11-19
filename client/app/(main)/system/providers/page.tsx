/**
 * app/(main)/system/providers/page.tsx
 * Providers list page - redirects to home with providers section
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import { getSession } from "@/auth";

import Providers from "@/components/providers/Providers";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag, unstable_cache } from "next/cache";

/** ---- Strong types from OpenAPI ---- */
type ProvidersListOut = OutputOf<"/api/v3/providers/list", "post">;
type DuplicateProviderIn = InputOf<"/api/v3/providers/duplicate", "post">;
type DuplicateProviderOut = OutputOf<"/api/v3/providers/duplicate", "post">;
type DeleteProviderIn = InputOf<"/api/v3/providers/delete", "post">;
type DeleteProviderOut = OutputOf<"/api/v3/providers/delete", "post">;
type DuplicateModelIn = InputOf<"/api/v3/providers/models/duplicate", "post">;
type DuplicateModelOut = OutputOf<"/api/v3/providers/models/duplicate", "post">;
type DeleteModelIn = InputOf<"/api/v3/providers/models/delete", "post">;
type DeleteModelOut = OutputOf<"/api/v3/providers/models/delete", "post">;

/** ---- Cached fetch with Next tags ----
 * Cache key includes profileId so entries are per-user.
 * Tags allow revalidateTag("providers") to invalidate.
 */
const getProvidersList = unstable_cache(
  async (profileId: string): Promise<ProvidersListOut> => {
    return api.post("/providers/list", { body: { profileId } });
  },
  ["providers:list"],
  { tags: ["providers"] }
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function duplicateProvider(
  input: DuplicateProviderIn,
): Promise<DuplicateProviderOut> {
  "use server";
  const out = await api.post("/providers/duplicate", input);
  revalidateTag("providers");
  const providerId = input.body?.providerId;
  if (providerId) {
    revalidateTag(`provider:${providerId}`);
  }
  return out;
}

async function deleteProvider(
  input: DeleteProviderIn,
): Promise<DeleteProviderOut> {
  "use server";
  const out = await api.post("/providers/delete", input);
  revalidateTag("providers");
  const providerId = input.body?.providerId;
  if (providerId) {
    revalidateTag(`provider:${providerId}`);
  }
  return out;
}

async function duplicateModel(
  input: DuplicateModelIn,
): Promise<DuplicateModelOut> {
  "use server";
  const out = await api.post("/providers/models/duplicate", input);
  revalidateTag("providers");
  const modelId = input.body?.modelId;
  if (modelId) {
    revalidateTag(`model:${modelId}`);
  }
  return out;
}

async function deleteModel(
  input: DeleteModelIn,
): Promise<DeleteModelOut> {
  "use server";
  const out = await api.post("/providers/models/delete", input);
  revalidateTag("providers");
  const modelId = input.body?.modelId;
  if (modelId) {
    revalidateTag(`model:${modelId}`);
  }
  return out;
}

export const metadata: Metadata = {
  title: "Providers",
  description: `Manage AI providers in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function ProvidersPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getProvidersList(profileId);

  return (
    <div className="space-y-6" data-page="providers-index">
      <Providers
        listData={listData}
        duplicateProviderAction={duplicateProvider}
        deleteProviderAction={deleteProvider}
        duplicateModelAction={duplicateModel}
        deleteModelAction={deleteModel}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteModelIn,
  DeleteModelOut,
  DeleteProviderIn,
  DeleteProviderOut,
  DuplicateModelIn,
  DuplicateModelOut,
  DuplicateProviderIn,
  DuplicateProviderOut,
  ProvidersListOut,
};
