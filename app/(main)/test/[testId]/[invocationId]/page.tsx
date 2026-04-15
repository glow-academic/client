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
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type ContextIn = InputOf<"/invocation/context", "post">;
type ContextOut = OutputOf<"/invocation/context", "post">;
type GetBenchmarkBundleOut = OutputOf<
  "/invocation/get",
  "post"
>;
type PatchBenchmarkDraftIn = InputOf<
  "/invocation/draft",
  "patch"
>;
type PatchBenchmarkDraftOut = OutputOf<
  "/invocation/draft",
  "patch"
>;
type ProblemTestIn = InputOf<"/test/problem", "post">;
type ProblemTestOut = OutputOf<"/test/problem", "post">;

const getBenchmarkBundle = async (
  bundleId: string,
  draftId: string | null,
): Promise<GetBenchmarkBundleOut> => {
  return api.post(
    "/invocation/get",
    {
      body: {
        benchmark_bundle_entry_id: bundleId,
        draft_id: draftId,
      },
    },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

async function patchBenchmarkDraft(
  input: PatchBenchmarkDraftIn,
): Promise<PatchBenchmarkDraftOut> {
  "use server";
  return api.patch("/invocation/draft", input);
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
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/invocation/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

  const bundleData = await getBenchmarkBundle(invocationId, draftId);

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
        { title: "Test", url: `/test/${testId}` },
        { title: "Invocation" },
      ]}
    >
      <div className="px-4">
        <Invocation
          bundleData={bundleData as InvocationData}
          testId={testId}
          patchBenchmarkDraftAction={patchBenchmarkDraft}
        />
      </div>
    </FullPageLayout>
  );
}
