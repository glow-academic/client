/**
 * app/(main)/system/providers/new/page.tsx
 * New provider page for the providers section.
 */

import Provider from "@/components/providers/Provider";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type ProviderNewIn = InputOf<"/api/v4/providers/new", "post">;
type ProviderNewOut = OutputOf<"/api/v4/providers/new", "post">;
type CreateProviderIn = InputOf<"/api/v4/providers/create", "post">;
type CreateProviderOut = OutputOf<"/api/v4/providers/create", "post">;
type PatchProviderDraftIn = InputOf<"/api/v4/providers/draft", "patch">;
type PatchProviderDraftOut = OutputOf<"/api/v4/providers/draft", "patch">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getProviderDefault = async (
  input: ProviderNewIn
): Promise<ProviderNewOut> => {
  return api.post("/providers/new", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createProvider(
  input: CreateProviderIn
): Promise<CreateProviderOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/providers/create", input);
}

async function patchProviderDraft(
  input: PatchProviderDraftIn
): Promise<PatchProviderDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/providers/draft", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Provider",
    description:
      "Create a new AI provider configuration for teaching assistant training platform. Configure provider settings, API endpoints, and maintain platform integrations for educational institutions and L&D programs.",
  };
}

export default async function NewProviderPage({
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

  // Inline server-side parsers for provider search params
  const providerSearchParams = {
    draftId: parseAsString,
  };
  const loadProviderSearchParams = createLoader(providerSearchParams);
  const q = loadProviderSearchParams(searchParamsObj);

  // Fetch default provider detail server-side with draft_id
  const input: ProviderNewIn = {
    body: {
      draft_id: q.draftId ?? null,
    } as ProviderNewIn["body"],
  };
  const providerDetailDefault = await getProviderDefault(input);

  return (
    <div
      className="space-y-6"
      data-page="provider-new"
      aria-label="Create new provider page"
    >
      <Provider
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        mode="create"
        providerDetailDefault={providerDetailDefault}
        createProviderAction={createProvider}
        patchProviderDraftAction={patchProviderDraft}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateProviderIn,
  CreateProviderOut,
  PatchProviderDraftIn,
  PatchProviderDraftOut,
  ProviderNewIn,
  ProviderNewOut,
};
