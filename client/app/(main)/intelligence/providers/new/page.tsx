/**
 * app/(main)/system/providers/new/page.tsx
 * New provider page for the providers section.
 */

import Provider from "@/components/artifacts/provider/Provider";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";
import { resolveGroupId } from "@/app/(main)/layout-server";

/** ---- Strong types from OpenAPI ---- */
type GetProviderIn = InputOf<"/api/v4/artifacts/providers/get", "post">;
type GetProviderOut = OutputOf<"/api/v4/artifacts/providers/get", "post">;
type SaveProviderIn = InputOf<"/api/v4/artifacts/providers/save", "post">;
type SaveProviderOut = OutputOf<"/api/v4/artifacts/providers/save", "post">;
type PatchProviderDraftIn = InputOf<"/api/v4/artifacts/providers/draft", "patch">;
type PatchProviderDraftOut = OutputOf<"/api/v4/artifacts/providers/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftValuesIn = InputOf<"/api/v4/resources/values", "post">;
type CreateDraftValuesOut = OutputOf<"/api/v4/resources/values", "post">;
type CreateDraftEndpointsIn = InputOf<"/api/v4/resources/endpoints", "post">;
type CreateDraftEndpointsOut = OutputOf<"/api/v4/resources/endpoints", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getProviderDefault = async (
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

async function createNames(
  input: CreateDraftNamesIn
): Promise<CreateDraftNamesOut> {
  "use server";
  return api.post("/resources/names", input);
}

async function createDescriptions(
  input: CreateDraftDescriptionsIn
): Promise<CreateDraftDescriptionsOut> {
  "use server";
  return api.post("/resources/descriptions", input);
}

async function createValues(
  input: CreateDraftValuesIn
): Promise<CreateDraftValuesOut> {
  "use server";
  return api.post("/resources/values", input);
}

async function createEndpoints(
  input: CreateDraftEndpointsIn
): Promise<CreateDraftEndpointsOut> {
  "use server";
  return api.post("/resources/endpoints", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/providers/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/providers/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/providers/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.new.title, description: docs.new.description };
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

  // Resolve group_id from layout context (cached per request)
  const groupId = await resolveGroupId(q.draftId ?? null, "provider");

  // Fetch default provider detail server-side with draft_id (provider_id = NULL for new mode)
  const input: GetProviderIn = {
    body: {
      provider_id: null,
      draft_id: q.draftId ?? null,
      group_id: groupId,
    } as GetProviderIn["body"],
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
        providerData={providerDetailDefault}
        saveProviderAction={saveProvider}
        patchProviderDraftAction={patchProviderDraft}
        createNamesAction={createNames}
        createDescriptionsAction={createDescriptions}
        createValuesAction={createValues}
        createEndpointsAction={createEndpoints}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  GetProviderIn,
  GetProviderOut,
  PatchProviderDraftIn,
  PatchProviderDraftOut,
  CreateDraftNamesIn,
  CreateDraftNamesOut,
  CreateDraftDescriptionsIn,
  CreateDraftDescriptionsOut,
  CreateDraftValuesIn,
  CreateDraftValuesOut,
  CreateDraftEndpointsIn,
  CreateDraftEndpointsOut,
  SaveProviderIn,
  SaveProviderOut,
};
