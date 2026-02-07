/**
 * app/benchmark/t/[testId]/page.tsx
 * Benchmark test detail page wired to artifacts/test/get endpoint.
 * @AshokSaravanan222 & @siladiea
 * 02/2025
 */

import EvalAttemptStatus from "@/components/benchmark/EvalAttemptStatus";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { api } from "@/lib/api/client";
import type { OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
export type TestArtifactOut = OutputOf<"/api/v4/artifacts/test/get", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getTestArtifact = async (
  testId: string,
): Promise<TestArtifactOut> => {
  return api.post(
    "/artifacts/test/get",
    { body: { test_id: testId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Metadata ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ testId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { testId } = await params;
  try {
    const data = await getTestArtifact(testId);
    const evalName = data?.eval_name;
    return {
      title: `Benchmark ${evalName || "Test"}`,
      description: `${evalName ? `${evalName} - ` : ""}Evaluation benchmark test for teaching assistant training platform.`,
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: `Benchmark Test ${testId.substring(0, 8)}...`,
    description:
      "Evaluation benchmark test for teaching assistant training platform.",
  };
}

/** ---- Page component ---- */
export default async function BenchmarkTestPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;

  try {
    const testData = await getTestArtifact(testId);

    return (
      <div className="space-y-6">
        <EvalAttemptStatus
          attemptId={testId}
          attemptData={testData}
        />
      </div>
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 403
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
