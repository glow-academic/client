/**
 * app/(main)/test/[testId]/page.tsx
 * Canonical test detail page — benchmark test/eval attempt status.
 * @AshokSaravanan222 & @siladiea
 * 02/2025
 */

import { getSession } from "@/auth";
import TestChat from "@/components/artifacts/test/setups/TestChat";
import { InvocationControls } from "@/components/common/InvocationControls";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { loadTestSearchParams } from "@/lib/search-params/test";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
export type TestArtifactOut = OutputOf<"/test/get", "post">;

type ContextIn = InputOf<"/test/context", "post">;
type ContextOut = OutputOf<"/test/context", "post">;
type TestGenerationsIn = InputOf<"/test/generations", "post">;
type TestGenerationsOut = OutputOf<"/test/generations", "post">;
type TestGroupIn = InputOf<"/test/group", "post">;
type TestGroupOut = OutputOf<"/test/group", "post">;
type ProblemTestIn = InputOf<"/test/problem", "post">;
type ProblemTestOut = OutputOf<"/test/problem", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
type TestGetIn = InputOf<"/test/get", "post">;
type TestGetBody = TestGetIn extends { body: infer B } ? B : never;

const getTestArtifact = async (
  testId: string,
  configsArgs?: {
    configs_groups_page?: number;
    configs_groups_page_size?: number;
    configs_expanded?: string[] | null;
    configs_expanded_page_size?: number;
    configs_search?: string | null;
    configs_selected?: string[] | null;
  },
): Promise<TestArtifactOut> => {
  const body = { test_id: testId } as TestGetBody;
  // Cast through partial since openapi may not have regenerated the
  // pagination params yet — server accepts unknown keys gracefully.
  const extra = body as unknown as Record<string, unknown>;
  if (configsArgs?.configs_groups_page !== undefined)
    extra["configs_groups_page"] = configsArgs.configs_groups_page;
  if (configsArgs?.configs_groups_page_size !== undefined)
    extra["configs_groups_page_size"] = configsArgs.configs_groups_page_size;
  if (configsArgs?.configs_expanded && configsArgs.configs_expanded.length > 0)
    extra["configs_expanded"] = configsArgs.configs_expanded;
  if (configsArgs?.configs_expanded_page_size !== undefined)
    extra["configs_expanded_page_size"] = configsArgs.configs_expanded_page_size;
  if (configsArgs?.configs_search) extra["configs_search"] = configsArgs.configs_search;
  if (configsArgs?.configs_selected && configsArgs.configs_selected.length > 0)
    extra["configs_selected"] = configsArgs.configs_selected;
  return api.post(
    "/test/get",
    { body },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Strongly-typed server actions ---- */
async function createTestProblem(input: ProblemTestIn): Promise<ProblemTestOut> {
  "use server";
  return api.post("/test/problem", input);
}

/** ---- GenerationPanel server actions ---- */
async function getTestGroup(input: TestGroupIn): Promise<TestGroupOut> {
  "use server";
  return api.post("/test/group", input);
}

async function searchTestGenerations(
  input: TestGenerationsIn,
): Promise<TestGenerationsOut> {
  "use server";
  return api.post("/test/generations", input);
}


/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getTestContextById = cache(
  async (id: string): Promise<ContextOut> =>
    api.post("/test/context", { body: { entity_id: id } } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ testId: string }>;
}): Promise<Metadata> {
  try {
    const { testId } = await params;
    const context = await getTestContextById(testId);
    return {
      title: context.page_metadata?.detail.title,
      description: context.page_metadata?.detail.description,
    };
  } catch {
    return { title: "Test" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

/** ---- Page component ---- */
export default async function TestPage({
  params,
  searchParams,
}: {
  params: Promise<{ testId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { testId } = await params;
  const q = loadTestSearchParams(await searchParams);
  const draftId = q.draftId;
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  try {
    // Profile data for providers + test data in parallel.
    // Configs pagination is read from URL search params (nuqs) and
    // threaded into /test/get for SSR — same pattern as benchmark
    // history.
    const [testData, context, groupResult] = await Promise.all([
      getTestArtifact(testId, {
        configs_groups_page: q.configsGroupsPage ?? 1,
        configs_groups_page_size: q.configsGroupsPageSize ?? 10,
        configs_expanded: q.configsExpanded ?? null,
        configs_expanded_page_size: q.configsExpandedPageSize ?? 20,
        configs_search: q.configsSearch ?? null,
        configs_selected: q.configsSelected ?? null,
      }),
      getTestContextById(testId) as Promise<ContextOut>,
      api.post(
        "/test/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as TestGroupIn,
      ),
    ]);
    const snapshot = buildSnapshot(session, context.profile);

    const entityName = context.page_metadata?.detail.title;

    return (
      <FullPageLayout
        profileData={context.profile}
        sessionSnapshot={snapshot}
        initialSidebarOpen={initialSidebarOpen}
        initialPanelOpen={initialPanelOpen}
        sidebarProps={{
          activeSection: "benchmark",
          createFeedback: createTestProblem,
        }}
        breadcrumbs={[
          { title: "Benchmark", section: "benchmark", url: "/benchmark" },
          { title: entityName ?? "Test" },
        ]}
        toolbar={
          testData.show_controls && testData.current_invocation_id ? (
            <InvocationControls
              testId={testId}
              currentInvocationId={testData.current_invocation_id}
              hasRunsOrGroups={testData.has_runs_or_groups ?? false}
            />
          ) : undefined
        }
        panelProps={{
          artifactType: "test",
          initialPanelPrefs: await readGenerationPanelPrefs(),
          groupId: (groupResult as TestGroupOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as TestGroupOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          operations: ["invocation_get", "invocation_create", "draft", "title"],
          prompts: context.prompts?.prompts,
          getGroupAction: getTestGroup as PanelProps["getGroupAction"],
          searchGenerationsAction:
            searchTestGenerations as PanelProps["searchGenerationsAction"],
        }}
      >
        <div className="px-4">
          <TestChat
            test_id={testId}
            test_data={testData}
            draft_id={draftId ?? null}
          />
        </div>
      </FullPageLayout>
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error
    ) {
      // 401 → not logged in (matches /home, /practice). 403 → resource
      // belongs to a department the user isn't in. Don't conflate.
      if (error.status === 401) {
        return (
          <UnifiedAccessDenied
            reason="not-logged-in"
            pathname={`/test/${testId}`}
          />
        );
      }
      if (error.status === 403) {
        return (
          <UnifiedAccessDenied
            reason="department"
            resourceType="test"
            redirectPath="/benchmark"
          />
        );
      }
    }
    throw error;
  }
}
