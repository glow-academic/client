/**
 * app/(main)/test/[testId]/[invocationId]/page.tsx
 * Canonical invocation page (benchmark bundle customization).
 * Nested under test — testId comes from route params.
 * @AshokSaravanan222 & @siladiea
 * 02/2025
 */

import { getSession } from "@/auth";
import Invocation, {
  type InvocationData,
} from "@/components/artifacts/invocation/Invocation";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";

/** ---- Strong types from OpenAPI ---- */
type ContextIn = InputOf<"/test/context", "post">;
type ContextOut = OutputOf<"/test/context", "post">;
type GetBenchmarkBundleOut = OutputOf<
  "/test/invocation_get",
  "post"
> & InvocationData;
type PatchBenchmarkDraftIn = InputOf<
  "/test/draft",
  "post"
>;
type PatchBenchmarkDraftOut = OutputOf<
  "/test/draft",
  "post"
>;
type ProblemTestIn = InputOf<"/test/problem", "post">;
type ProblemTestOut = OutputOf<"/test/problem", "post">;

const getBenchmarkBundle = async (
  testId: string,
  bundleId: string,
  draftId: string | null,
): Promise<GetBenchmarkBundleOut> => {
  return (await api.post(
    "/test/invocation_get",
    ({
      body: {
        test_id: testId,
        invocation_id: bundleId,
        draft_id: draftId,
      },
    } as unknown as InputOf<"/test/invocation_get", "post">),
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  )) as GetBenchmarkBundleOut;
};

async function patchBenchmarkDraft(
  input: PatchBenchmarkDraftIn,
): Promise<PatchBenchmarkDraftOut> {
  "use server";
  return api.post("/test/draft", input);
}

async function exportInvocation(
  targetTestId: string,
  targetInvocationId: string,
): Promise<{ file_id: string; file_name?: string }> {
  "use server";
  return api.post(
    "/test/export" as Parameters<typeof api.post>[0],
    {
      body: {
        view: "invocation",
        test_id: targetTestId,
        invocation_id: targetInvocationId,
      } as unknown as InputOf<"/test/export", "post">,
    },
  ) as Promise<{ file_id: string; file_name?: string }>;
}

async function createTestProblem(input: ProblemTestIn): Promise<ProblemTestOut> {
  "use server";
  return api.post("/test/problem", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Customize Benchmark",
    description: "Customize resources for a benchmark run.",
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function InvocationPage({
  params,
  searchParams,
}: {
  params: Promise<{ testId: string; invocationId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { testId, invocationId } = await params;
  const sp = await searchParams;
  const rawDraftId = sp["draftId"];
  const draftId =
    typeof rawDraftId === "string"
      ? rawDraftId
      : Array.isArray(rawDraftId)
        ? (rawDraftId[0] ?? null)
        : null;

  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : false;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  try {
    // Profile data for providers
    const context = await api.post("/test/context", { body: {} } as ContextIn) as ContextOut;
    const snapshot = buildSnapshot(session, context.profile);

    const bundleData = await getBenchmarkBundle(testId, invocationId, draftId);

    return (
      <FullPageLayout
        profileData={context.profile}
        sessionSnapshot={snapshot}
        initialSidebarOpen={initialSidebarOpen}
        initialPanelOpen={initialPanelOpen}
        sidebarProps={{
          activeSection: "benchmark",
          createFeedback: createTestProblem as unknown as (
            input: Record<string, unknown>,
          ) => Promise<Record<string, unknown>>,
        }}
        breadcrumbs={[
          { title: "Benchmark", section: "benchmark", url: "/benchmark" },
          { title: "Test", url: `/test/${testId}` },
          { title: "Invocation" },
        ]}
        toolbar={
          <ArtifactToolbarActions
            exportAction={exportInvocation.bind(null, testId, invocationId)}
            bffDownloadPrefix="/api/test/download"
          />
        }
      >
        <div className="px-4">
          <Invocation
            bundleData={bundleData as InvocationData}
            testId={testId}
            patchInvocationDraftAction={patchBenchmarkDraft}
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
      if (error.status === 401) {
        return (
          <UnifiedAccessDenied
            reason="not-logged-in"
            pathname={`/test/${testId}/${invocationId}`}
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
