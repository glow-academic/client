/**
 * app/(main)/intelligence/providers/new/page.tsx
 * New provider page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Provider from "@/components/artifacts/provider/Provider";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

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
type GroupProviderIn = InputOf<"/providers/group", "post">;
type GroupProviderOut = OutputOf<"/providers/group", "post">;
type GenerateProviderIn = InputOf<"/providers/generate", "post">;
type GenerateProviderOut = OutputOf<"/providers/generate", "post">;
type ProblemProviderIn = InputOf<"/providers/problem", "post">;
type ProblemProviderOut = OutputOf<"/providers/problem", "post">;
type ContextIn = InputOf<"/providers/context", "post">;
type ContextOut = OutputOf<"/providers/context", "post">;

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

async function generateProvider(
  input: GenerateProviderIn
): Promise<GenerateProviderOut> {
  "use server";
  return api.post("/providers/generate", input);
}

async function getProviderGroupHistory(groupId: string): Promise<GroupProviderOut> {
  "use server";
  return api.post("/providers/group", { body: { group_id: groupId } } as GroupProviderIn);
}

type GenerationsIn = InputOf<"/providers/generations", "post">;
type GenerationsOut = OutputOf<"/providers/generations", "post">;

async function searchProviderGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/providers/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createProviderProblem(input: ProblemProviderIn): Promise<ProblemProviderOut> {
  "use server";
  return api.post("/providers/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/providers/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.new.title,
    description: context.page_metadata?.new.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function NewProviderPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/providers/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

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
  const [providerDetailDefault, draftsResult, groupResult] = await Promise.all([
    getProviderDefault(input),
    api.post("/providers/drafts", {}),
    api.post("/providers/group", { body: {} } as GroupProviderIn),
  ]);

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
          { title: "New Provider" },
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
          data-page="provider-new"
          aria-label="Create new provider page"
        >
          <Provider
            key={q.draftId || "no-draft"}
            providerData={providerDetailDefault}
            createProviderAction={createProvider}
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
