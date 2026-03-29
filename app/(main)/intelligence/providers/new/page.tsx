/**
 * app/(main)/system/providers/new/page.tsx
 * New provider page for the providers section.
 */

import Provider from "@/components/artifacts/provider/Provider";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetProviderIn = InputOf<"/providers/get", "post">;
type GetProviderOut = OutputOf<"/providers/get", "post">;
type CreateProviderIn = InputOf<"/providers/create", "post">;
type CreateProviderOut = OutputOf<"/providers/create", "post">;
type PatchProviderDraftIn = InputOf<"/providers/draft", "patch">;
type PatchProviderDraftOut = OutputOf<"/providers/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v5/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v5/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v5/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v5/resources/descriptions",
  "post"
>;
type CreateDraftValuesIn = InputOf<"/api/v5/resources/values", "post">;
type CreateDraftValuesOut = OutputOf<"/api/v5/resources/values", "post">;
type CreateDraftEndpointsIn = InputOf<"/api/v5/resources/endpoints", "post">;
type CreateDraftEndpointsOut = OutputOf<"/api/v5/resources/endpoints", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getProviderDefault = async (
  input: GetProviderIn
): Promise<GetProviderOut> => {
  return api.post("/providers/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
    signal: AbortSignal.timeout(30000), // 30 second timeout
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createProvider(
  input: CreateProviderIn
): Promise<CreateProviderOut> {
  "use server";
  return api.post("/providers/create", input);
}

async function patchProviderDraft(
  input: PatchProviderDraftIn
): Promise<PatchProviderDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/providers/draft", input);
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
type DocsIn = InputOf<"/providers/docs", "post">;
type DocsOut = OutputOf<"/providers/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/providers/docs", input);
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

  // Fetch default provider detail server-side with draft_id (provider_id = NULL for new mode)
  const input: GetProviderIn = {
    body: {
      provider_id: null,
      draft_id: q.draftId ?? null,
    } as GetProviderIn["body"],
  };
  const [providerDetailDefault, draftsResult] = await Promise.all([
    getProviderDefault(input),
    api.post("/providers/drafts", {})
  ]);

  return (
    <DraftProviderClient drafts={draftsResult.entries ?? []}>
      <PageHeader
        breadcrumbs={[
          { title: "Intelligence", section: "intelligence", url: "/intelligence" },
          { title: "Providers", section: "providers", url: "/intelligence/providers" },
          { title: "New Provider" },
        ]}
        toolbar={<SaveToolbar />}
      />
      <div
        className="space-y-6 px-4"
        data-page="provider-new"
        aria-label="Create new provider page"
      >
        <Provider
          key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
          providerData={providerDetailDefault}
          createProviderAction={createProvider}
          patchProviderDraftAction={patchProviderDraft}
          createNamesAction={createNames}
          createDescriptionsAction={createDescriptions}
          createValuesAction={createValues}
          createEndpointsAction={createEndpoints}
        />
      </div>
    </DraftProviderClient>
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
  CreateProviderIn,
  CreateProviderOut,
};
