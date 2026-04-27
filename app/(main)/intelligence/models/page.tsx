/**
 * app/(main)/intelligence/models/page.tsx
 * Models list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Models from "@/components/artifacts/model/Models";

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { loadModelsSearchParams } from "@/lib/search-params/models";
import { readViewCookie } from "@/lib/view-cookie";

/** ---- Strong types from OpenAPI ---- */
type ModelsListOut = OutputOf<"/model/search", "post">;
type DuplicateModelIn = InputOf<"/model/duplicate", "post">;
type DuplicateModelOut = OutputOf<"/model/duplicate", "post">;
type DeleteModelIn = InputOf<"/model/delete", "post">;
type DeleteModelOut = OutputOf<"/model/delete", "post">;
type UpdateModelIn = InputOf<"/model/update", "post">;
type UpdateModelOut = OutputOf<"/model/update", "post">;
type GroupModelIn = InputOf<"/model/group", "post">;
type GroupModelOut = OutputOf<"/model/group", "post">;
type GenerateModelIn = InputOf<"/model/generate", "post">;
type GenerateModelOut = OutputOf<"/model/generate", "post">;
type GenerationsIn = InputOf<"/model/generations", "post">;
type GenerationsOut = OutputOf<"/model/generations", "post">;
type ProblemModelIn = InputOf<"/model/problem", "post">;
type ProblemModelOut = OutputOf<"/model/problem", "post">;
type ContextIn = InputOf<"/model/context", "post">;
type ContextOut = OutputOf<"/model/context", "post">;

/** ---- Body type for models list request ---- */
type ModelsListBody = {
  search?: string | null;
  filter_provider_ids?: string[] | null;
  filter_department_ids?: string[] | null;
  filter_agent_ids?: string[] | null;
  provider_search?: string | null;
  department_search?: string | null;
  agent_search?: string | null;
  page_size: number | null;
  page_offset: number | null;
};

/** ---- Direct fetch (no Next.js cache) ---- */
const getModelsList = async (body: ModelsListBody): Promise<ModelsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/model/search",
    { body },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: { "X-Bypass-Cache": "1" },
      }),
    },
  );
};

/** ---- Strongly-typed server actions ---- */
async function duplicateModel(
  input: DuplicateModelIn,
): Promise<DuplicateModelOut> {
  "use server";
  return api.post("/model/duplicate", input);
}

async function deleteModel(input: DeleteModelIn): Promise<DeleteModelOut> {
  "use server";
  return api.post("/model/delete", input);
}

async function updateModel(input: UpdateModelIn): Promise<UpdateModelOut> {
  "use server";
  return api.post("/model/update", input);
}

async function generateModel(
  input: GenerateModelIn
): Promise<GenerateModelOut> {
  "use server";
  return api.post("/model/generate", input);
}

async function getModelGroupHistory(groupId: string): Promise<GroupModelOut> {
  "use server";
  return api.post("/model/group", { body: { group_id: groupId } } as GroupModelIn);
}

async function searchModelGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/model/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createModelProblem(input: ProblemModelIn): Promise<ProblemModelOut> {
  "use server";
  return api.post("/model/problem", input);
}

/** ---- GenerationPanel server actions ---- */
async function getModelGroup(input: GroupModelIn): Promise<GroupModelOut> {
  "use server";
  return api.post("/model/group", input);
}

async function searchModelGenerations(input: GenerationsIn): Promise<GenerationsOut> {
  "use server";
  return api.post("/model/generations", input);
}

async function runModelGenerate(input: GenerateModelIn): Promise<GenerateModelOut> {
  "use server";
  return api.post("/model/generate", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await api.post("/model/context", { body: {} } as ContextIn) as ContextOut;
    return {
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Models" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface ModelsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ModelsPage({ searchParams }: ModelsPageProps) {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  try {
    // Profile data for providers
    const context = await api.post("/model/context", { body: {} } as ContextIn) as ContextOut;
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/intelligence/models", context.profile.role_permissions);

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

    const q = loadModelsSearchParams(searchParamsObj);

    // Compute pagination
    const pageIndex = q.page ?? 0;
    const pageSize = q.pageSize ?? 12;
    const offset = pageIndex * pageSize;

    // Build request body with filter values from URL
    const body: ModelsListBody = {
      search: q.search || null,
      filter_provider_ids: q.providerIds && q.providerIds.length > 0 ? q.providerIds : null,
      filter_department_ids: q.departmentIds && q.departmentIds.length > 0 ? q.departmentIds : null,
      filter_agent_ids: q.agentIds && q.agentIds.length > 0 ? q.agentIds : null,
      provider_search: q.providerSearch || null,
      department_search: q.departmentSearch || null,
      agent_search: q.agentSearch || null,
      page_size: pageSize,
      page_offset: offset,
    };

    // Fetch list data, view cookie, and group in parallel
    const [listData, initialColumnVisibility, groupResult] = await Promise.all([
      getModelsList(body),
      readViewCookie("models"),
      api.post(
        "/model/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupModelIn,
      ),
    ]);

    return (
      <FullPageLayout
        profileData={context.profile}
        sessionSnapshot={snapshot}
        initialSidebarOpen={initialSidebarOpen}
        initialPanelOpen={initialPanelOpen}
        sidebarProps={{
          activeSection: "model",
          createFeedback: createModelProblem,
        }}
        breadcrumbs={[
          { title: "Intelligence", section: "intelligence", url: "/intelligence" },
          { title: "Models" },
        ]}
        toolbar={<NewArtifactButton label="New Model" href="/intelligence/models/new" />}
        panelProps={{
          artifactType: "model",
          groupId: (groupResult as GroupModelOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as GroupModelOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          generateAction: generateModel,
          operations: ["draft", "get", "group"],
          getGroupHistory: getModelGroupHistory,
          searchGroups: searchModelGroups,
          prompts: context.prompts?.prompts,
          getGroupAction: getModelGroup as PanelProps["getGroupAction"],
          searchGenerationsAction:
            searchModelGenerations as PanelProps["searchGenerationsAction"],
          runGenerateAction: runModelGenerate as PanelProps["runGenerateAction"],
        }}
      >
        <div className="space-y-6 px-4" data-page="models-index">
          <Models
            listData={listData}
            initialColumnVisibility={initialColumnVisibility}
            duplicateModelAction={duplicateModel}
            deleteModelAction={deleteModel}
            updateModelAction={updateModel}
            pageIndex={pageIndex}
            pageSize={pageSize}
            totalCount={listData.total_count ?? 0}
            providerSearch={q.providerSearch ?? ""}
            departmentSearch={q.departmentSearch ?? ""}
            agentSearch={q.agentSearch ?? ""}
          />
        </div>
      </FullPageLayout>
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
          pathname="/intelligence/models"
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteModelIn,
  DeleteModelOut,
  DuplicateModelIn,
  DuplicateModelOut,
  ModelsListOut,
  UpdateModelIn,
  UpdateModelOut,
};
