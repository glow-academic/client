/**
 * app/(main)/intelligence/providers/[providerId]/page.tsx
 * Provider edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Provider from "@/components/artifacts/provider/Provider";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type GetProviderIn = InputOf<"/provider/get", "post">;
type GetProviderOut = OutputOf<"/provider/get", "post">;
type CreateProviderIn = InputOf<"/provider/create", "post">;
type CreateProviderOut = OutputOf<"/provider/create", "post">;
type UpdateProviderIn = InputOf<"/provider/update", "post">;
type UpdateProviderOut = OutputOf<"/provider/update", "post">;
type PatchProviderDraftIn = InputOf<"/provider/draft", "patch">;
type PatchProviderDraftOut = OutputOf<"/provider/draft", "patch">;
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
type GroupProviderIn = InputOf<"/provider/group", "post">;
type GroupProviderOut = OutputOf<"/provider/group", "post">;
type GenerateProviderIn = InputOf<"/provider/generate", "post">;
type GenerateProviderOut = OutputOf<"/provider/generate", "post">;
type ProblemProviderIn = InputOf<"/provider/problem", "post">;
type ProblemProviderOut = OutputOf<"/provider/problem", "post">;
type ContextIn = InputOf<"/provider/context", "post">;
type ContextOut = OutputOf<"/provider/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getProvider = async (
  input: GetProviderIn
): Promise<GetProviderOut> => {
  return api.post("/provider/get", input, {
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
  return api.post("/provider/create", input);
}

async function updateProvider(
  input: UpdateProviderIn
): Promise<UpdateProviderOut> {
  "use server";
  return api.post("/provider/update", input);
}

async function patchProviderDraft(
  input: PatchProviderDraftIn
): Promise<PatchProviderDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/provider/draft", input);
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

async function generateProvider(
  input: GenerateProviderIn
): Promise<GenerateProviderOut> {
  "use server";
  return api.post("/provider/generate", input);
}

async function getProviderGroupHistory(groupId: string): Promise<GroupProviderOut> {
  "use server";
  return api.post("/provider/group", { body: { group_id: groupId } } as GroupProviderIn);
}

type GenerationsIn = InputOf<"/provider/generations", "post">;
type GenerationsOut = OutputOf<"/provider/generations", "post">;

async function searchProviderGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/provider/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createProviderProblem(input: ProblemProviderIn): Promise<ProblemProviderOut> {
  "use server";
  return api.post("/provider/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ providerId: string }>;
}): Promise<Metadata> {
  const { providerId } = await params;
  const context = await api.post("/provider/context", { body: { entity_id: providerId } } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.detail.title,
    description: context.page_metadata?.detail.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

/** ---- Server renders client with typed data (read-only, mutations in child components) ---- */
export default async function EditProviderPage({
  params,
  searchParams,
}: {
  params: Promise<{ providerId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { providerId } = await params;
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/provider/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

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
    const [providerDetail, context, draftsResult, groupResult] = await Promise.all([
      getProvider(input).catch(() => null),
      api.post("/provider/context", { body: { entity_id: providerId } } as ContextIn) as Promise<ContextOut>,
      api.post("/provider/drafts", {}),
      api.post("/provider/group", { body: {} } as GroupProviderIn),
    ]);

    if (!providerDetail) {
      throw new Error("Provider not found");
    }

    const entityName = context.page_metadata?.detail.title;

    return (
      <DraftProviderClient drafts={draftsResult.entries ?? []}>
        <FullPageLayout
          profileData={context.profile}
          sessionSnapshot={snapshot}
          initialSidebarOpen={initialSidebarOpen}
          initialPanelOpen={initialPanelOpen}
          sidebarProps={{
            activeSection: "provider",
            createFeedback: createProviderProblem,
          }}
          breadcrumbs={[
            { title: "Intelligence", section: "intelligence", url: "/intelligence" },
            { title: "Providers", section: "providers", url: "/intelligence/providers" },
            { title: entityName },
          ]}
          toolbar={<SaveToolbar />}
          panelProps={{
            artifactType: "provider",
            groupId: (groupResult as GroupProviderOut & { group_id?: string })?.group_id ?? null,
            generateAction: generateProvider,
            permissions: [
              { artifact: "provider", operation: "draft" },
              { artifact: "provider", operation: "get" },
              { artifact: "provider", operation: "docs" },
              { artifact: "provider", operation: "group" },
            ],
            getGroupHistory: getProviderGroupHistory,
            searchGroups: searchProviderGroups,
          }}
        >
          <div
            className="space-y-6 px-4"
            data-page="provider-edit"
            data-provider-id={providerId}
          >
            <Provider
              providerId={providerId}
              providerData={providerDetail}
              createProviderAction={createProvider}
              updateProviderAction={updateProvider}
              patchProviderDraftAction={patchProviderDraft}
              createNamesAction={createNames}
              createDescriptionsAction={createDescriptions}
              createValuesAction={createValues}
              createEndpointsAction={createEndpoints}
            />
          </div>
        </FullPageLayout>
      </DraftProviderClient>
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
  UpdateProviderIn,
  UpdateProviderOut,
};
