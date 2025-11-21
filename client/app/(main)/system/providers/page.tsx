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
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

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

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getProvidersList = async (
  profileId: string
): Promise<ProvidersListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/providers/list",
    { body: { profileId } },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    }
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function duplicateProvider(
  input: DuplicateProviderIn,
): Promise<DuplicateProviderOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/providers/duplicate", input);
}

async function deleteProvider(
  input: DeleteProviderIn,
): Promise<DeleteProviderOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/providers/delete", input);
}

async function duplicateModel(
  input: DuplicateModelIn,
): Promise<DuplicateModelOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/providers/models/duplicate", input);
}

async function deleteModel(
  input: DeleteModelIn,
): Promise<DeleteModelOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/providers/models/delete", input);
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
