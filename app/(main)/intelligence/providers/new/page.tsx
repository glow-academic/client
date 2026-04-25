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

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type GetProviderIn = InputOf<"/provider/get", "post">;
type GetProviderOut = OutputOf<"/provider/get", "post">;
type CreateProviderIn = InputOf<"/provider/create", "post">;
type CreateProviderOut = OutputOf<"/provider/create", "post">;
type PatchProviderDraftIn = InputOf<"/provider/draft", "patch">;
type PatchProviderDraftOut = OutputOf<"/provider/draft", "patch">;
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
const getProviderDefault = async (
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

async function patchProviderDraft(
  input: PatchProviderDraftIn
): Promise<PatchProviderDraftOut> {
  "use server";
  return api.patch("/provider/draft", input);
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
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await api.post("/provider/context", { body: {} } as ContextIn) as ContextOut;
    return {
      title: context.page_metadata?.new.title,
      description: context.page_metadata?.new.description,
    };
  } catch {
    return { title: "Providers" };
  }
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

  try {
    // Profile data for providers
    const context = await api.post("/provider/context", { body: {} } as ContextIn) as ContextOut;
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
      descriptionSearch: parseAsString,
      valueSearch: parseAsString,
      endpointSearch: parseAsString,
      keySearch: parseAsString,
      departmentShowSelected: parseAsBoolean,
      valueShowSelected: parseAsBoolean,
      endpointShowSelected: parseAsBoolean,
      keyShowSelected: parseAsBoolean,
    };
    const loadProviderSearchParams = createLoader(providerSearchParams);
    const q = loadProviderSearchParams(searchParamsObj);

    // Fetch default provider detail server-side with draft_id (provider_id = NULL for new mode)
    const input = {
      body: {
        id: null,
        draft_id: q.draftId ?? null,
        descriptions: q.descriptionSearch
          ? { search: q.descriptionSearch ?? undefined }
          : undefined,
        departments: q.departmentShowSelected
          ? { selected: q.departmentShowSelected ?? undefined }
          : undefined,
        values: q.valueSearch || q.valueShowSelected
          ? {
              search: q.valueSearch ?? undefined,
              selected: q.valueShowSelected ?? undefined,
            }
          : undefined,
        endpoints: q.endpointSearch || q.endpointShowSelected
          ? {
              search: q.endpointSearch ?? undefined,
              selected: q.endpointShowSelected ?? undefined,
            }
          : undefined,
        keys: q.keySearch || q.keyShowSelected
          ? {
              search: q.keySearch ?? undefined,
              selected: q.keyShowSelected ?? undefined,
            }
          : undefined,
      },
    } as GetProviderIn;
    const [providerDetailDefault, draftsResult, groupResult] = await Promise.all([
      getProviderDefault(input),
      api.post("/provider/drafts", {}),
      api.post("/provider/group", { body: {} } as GroupProviderIn),
    ]);

    return (
      <DraftProviderClient drafts={(draftsResult.entries ?? []) as any}>
        <FullPageLayout
          {...({
            profileData: context.profile,
            sessionSnapshot: snapshot,
            initialSidebarOpen,
            initialPanelOpen,
            sidebarProps: {
              activeSection: "provider",
              createFeedback: createProviderProblem,
            },
            breadcrumbs: [
              { title: "Intelligence", section: "intelligence", url: "/intelligence" },
              { title: "Providers", section: "providers", url: "/intelligence/providers" },
              { title: "New Provider" },
            ],
            toolbar: <SaveToolbar />,
            panelProps: {
              artifactType: "provider",
              groupId: (groupResult as GroupProviderOut & { group_id?: string })?.group_id ?? null,
              generateAction: generateProvider,
              operations: ["draft", "get", "group"],
              getGroupHistory: getProviderGroupHistory,
              searchGroups: searchProviderGroups,
              prompts: context.prompts?.prompts,
            },
          } as any)}
        >
          <div
            className="space-y-6 px-4"
            data-page="provider-new"
            aria-label="Create new provider page"
          >
            <Provider
              providerData={providerDetailDefault}
              createProviderAction={createProvider}
              patchProviderDraftAction={patchProviderDraft}
            />
          </div>
        </FullPageLayout>
      </DraftProviderClient>
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error.status === 401 || error.status === 403)
    ) {
      return (
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname="/intelligence/providers/new"
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  GetProviderIn,
  GetProviderOut,
  PatchProviderDraftIn,
  PatchProviderDraftOut,
  CreateProviderIn,
  CreateProviderOut,
};
