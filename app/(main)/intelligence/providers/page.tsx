/**
 * app/(main)/intelligence/providers/page.tsx
 * Providers list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Providers from "@/components/artifacts/provider/Providers";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { getLayoutContextData } from "@/app/(main)/layout-server";
import { loadProvidersSearchParams } from "@/lib/search-params/providers";

/** ---- Strong types from OpenAPI ---- */
type ProvidersListOut = OutputOf<"/providers/search", "post">;
type DeleteProviderIn = InputOf<"/providers/delete", "post">;
type DeleteProviderOut = OutputOf<"/providers/delete", "post">;
type GroupProviderIn = InputOf<"/providers/group", "post">;
type GroupProviderOut = OutputOf<"/providers/group", "post">;
type GenerateProviderIn = InputOf<"/providers/generate", "post">;
type GenerateProviderOut = OutputOf<"/providers/generate", "post">;
type GenerationsIn = InputOf<"/providers/generations", "post">;
type GenerationsOut = OutputOf<"/providers/generations", "post">;
type ProblemProviderIn = InputOf<"/providers/problem", "post">;
type ProblemProviderOut = OutputOf<"/providers/problem", "post">;
type ContextIn = InputOf<"/providers/context", "post">;
type ContextOut = OutputOf<"/providers/context", "post">;

/** ---- Body type for providers list request ---- */
type ProvidersListBody = {
  search?: string | null;
  filter_department_ids?: string[] | null;
  filter_model_ids?: string[] | null;
  filter_status?: string[] | null;
  department_search?: string | null;
  model_search?: string | null;
  page_size: number | null;
  page_offset: number | null;
};

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getProvidersList = async (body: ProvidersListBody): Promise<ProvidersListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/providers/search",
    { body },
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
async function deleteProvider(
  input: DeleteProviderIn
): Promise<DeleteProviderOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/providers/delete", {
    ...input,
    body: { ...input.body },
  });
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
    title: context.page_metadata?.list.title,
    description: context.page_metadata?.list.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface ProvidersPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ProvidersPage({ searchParams }: ProvidersPageProps) {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const { profileData, snapshot } = await getLayoutContextData(session);

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

  const q = loadProvidersSearchParams(searchParamsObj);

  // Compute pagination
  const pageIndex = q.page ?? 0;
  const pageSize = q.pageSize ?? 12;
  const offset = pageIndex * pageSize;

  // Build request body with filter values from URL
  const body: ProvidersListBody = {
    search: q.search || null,
    filter_department_ids: q.departmentIds && q.departmentIds.length > 0 ? q.departmentIds : null,
    filter_model_ids: q.modelIds && q.modelIds.length > 0 ? q.modelIds : null,
    filter_status: q.statusIds && q.statusIds.length > 0 ? q.statusIds : null,
    department_search: q.departmentSearch || null,
    model_search: q.modelSearch || null,
    page_size: pageSize,
    page_offset: offset,
  };

  // Fetch list data, and group in parallel
  const [listData, groupResult] = await Promise.all([
    getProvidersList(body),
    api.post("/providers/group", { body: {} } as GroupProviderIn),
  ]);

  return (
    <FullPageLayout
      profileData={profileData}
      sessionSnapshot={snapshot}
      initialSidebarOpen={initialSidebarOpen}
      initialPanelOpen={initialPanelOpen}
      sidebarProps={{
        activeSection: "provider",
        createFeedback: createProviderProblem,
      }}
      breadcrumbs={[
        { title: "Intelligence", section: "intelligence", url: "/intelligence" },
        { title: "Providers" },
      ]}
      toolbar={<NewArtifactButton label="New Provider" href="/intelligence/providers/new" />}
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
      <div className="space-y-6 px-4" data-page="providers-index">
        <Providers
          listData={listData}
          deleteProviderAction={deleteProvider}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={listData.total_count ?? 0}
          departmentSearch={q.departmentSearch ?? ""}
          modelSearch={q.modelSearch ?? ""}
        />
      </div>
    </FullPageLayout>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { DeleteProviderIn, DeleteProviderOut, ProvidersListOut };
