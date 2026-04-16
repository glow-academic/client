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
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
export type TestArtifactOut = OutputOf<"/test/get", "post">;

type ContextIn = InputOf<"/test/context", "post">;
type ContextOut = OutputOf<"/test/context", "post">;
type GenerateTestIn = InputOf<"/test/generate", "post">;
type GenerateTestOut = OutputOf<"/test/generate", "post">;
type GenerationsIn = InputOf<"/test/generations", "post">;
type GenerationsOut = OutputOf<"/test/generations", "post">;
type GroupTestIn = InputOf<"/test/group", "post">;
type GroupTestOut = OutputOf<"/test/group", "post">;
type ProblemTestIn = InputOf<"/test/problem", "post">;
type ProblemTestOut = OutputOf<"/test/problem", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getTestArtifact = async (
  testId: string,
): Promise<TestArtifactOut> => {
  return api.post(
    "/test/get",
    { body: { test_id: testId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Strongly-typed server actions ---- */
async function generateTest(
  input: GenerateTestIn,
): Promise<GenerateTestOut> {
  "use server";
  return api.post("/test/generate", input);
}

async function getTestGroupHistory(groupId: string): Promise<GroupTestOut> {
  "use server";
  return api.post("/test/group", { body: { group_id: groupId } } as GroupTestIn);
}

async function searchTestGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/test/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createTestProblem(input: ProblemTestIn): Promise<ProblemTestOut> {
  "use server";
  return api.post("/test/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ testId: string }>;
}): Promise<Metadata> {
  try {
    const { testId } = await params;
    const context = await api.post("/test/context", { body: { entity_id: testId } } as ContextIn) as ContextOut;
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
  searchParams: Promise<{ draftId?: string }>;
}) {
  const { testId } = await params;
  const { draftId } = await searchParams;
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/test/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

  try {
    const [testData, context, groupResult] = await Promise.all([
      getTestArtifact(testId),
      api.post("/test/context", { body: { entity_id: testId } } as ContextIn) as Promise<ContextOut>,
      api.post("/test/group", { body: {} } as GroupTestIn),
    ]);

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
          groupId: (groupResult as GroupTestOut & { group_id?: string })?.group_id ?? null,
          generateAction: generateTest,
          operations: ["draft", "get", "group"],
          getGroupHistory: getTestGroupHistory,
          searchGroups: searchTestGroups,
          prompts: context.prompts?.prompts,
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
      "status" in error &&
      (error.status === 401 || error.status === 403)
    ) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="eval"
          redirectPath="/benchmark"
        />
      );
    }
    throw error;
  }
}
