/**
 * app/(main)/intelligence/providers/p/[providerId]/page.tsx
 * Provider editing page
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Provider from "@/components/providers/Provider";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetProviderIn = InputOf<"/api/v4/artifacts/providers/get", "post">;
type GetProviderOut = OutputOf<"/api/v4/artifacts/providers/get", "post">;

type SaveProviderIn = InputOf<"/api/v4/artifacts/providers/save", "post">;
type SaveProviderOut = OutputOf<"/api/v4/artifacts/providers/save", "post">;
type PatchProviderDraftIn = InputOf<"/api/v4/artifacts/providers/draft", "patch">;
type PatchProviderDraftOut = OutputOf<"/api/v4/artifacts/providers/draft", "patch">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getProvider = async (
  input: GetProviderIn
): Promise<GetProviderOut> => {
  return api.post("/artifacts/providers/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
    signal: AbortSignal.timeout(30000), // 30 second timeout
  });
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ providerId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { providerId } = await params;
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const input: GetProviderIn = {
      body: {
        provider_id: providerId,
      } as GetProviderIn["body"],
    };
    const provider = await getProvider(input);
    const providerName =
      provider?.resources?.current?.names?.[0]?.name || "Provider";
    return {
      title: providerName,
      description: `${providerName !== "Provider" ? `${providerName} - ` : ""}AI provider configuration for teaching assistant training platform. Manage provider settings, API endpoints, and platform integrations for educational institutions and L&D programs.`,
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Provider",
    description:
      "AI provider configuration for teaching assistant training platform. Manage provider settings, API endpoints, and platform integrations for educational institutions and L&D programs.",
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function saveProvider(
  input: SaveProviderIn
): Promise<SaveProviderOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/providers/save", input, {
    signal: AbortSignal.timeout(30000), // 30 second timeout
  });
}

async function patchProviderDraft(
  input: PatchProviderDraftIn
): Promise<PatchProviderDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/artifacts/providers/draft", input);
}

/** ---- Server renders client with typed data (read-only, mutations in child components) ---- */
export default async function EditProviderPage({
  params,
  searchParams,
}: {
  params: Promise<{ providerId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { providerId } = await params;
  // Access control is handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Parse search params using nuqs
  const paramsObj = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(paramsObj).forEach(([key, value]) => {
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

  // Fetch data for edit mode (always fresh - source of truth) with draft_id
  try {
    const input: GetProviderIn = {
      body: {
        provider_id: providerId,
        draft_id: q.draftId ?? null,
      } as GetProviderIn["body"],
    };
    const providerDetail = await getProvider(input).catch(() => null);

    if (!providerDetail) {
      throw new Error("Provider not found");
    }

    return (
      <div
        className="space-y-6"
        data-page="provider-edit"
        data-provider-id={providerId}
      >
        <Provider
          providerId={providerId}
          providerData={providerDetail}
          saveProviderAction={saveProvider}
          patchProviderDraftAction={patchProviderDraft}
        />
      </div>
    );
  } catch (error: unknown) {
    // Check if it's a 403 error (department access denied)
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 403
    ) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="provider"
          redirectPath="/intelligence/providers"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  GetProviderIn,
  GetProviderOut,
  PatchProviderDraftIn,
  PatchProviderDraftOut,
  SaveProviderIn,
  SaveProviderOut,
};
