/**
 * app/(main)/test/[testId]/page.tsx
 * Canonical test detail page — benchmark test/eval attempt status.
 * @AshokSaravanan222 & @siladiea
 * 02/2025
 */

import TestChat from "@/components/artifacts/test/setups/TestChat";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
export type TestArtifactOut = OutputOf<"/api/v5/artifacts/test/get", "post">;

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

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v5/artifacts/benchmark/docs", "post">;
type DocsOut = OutputOf<"/api/v5/artifacts/benchmark/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/benchmark/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ testId: string }>;
}): Promise<Metadata> {
  const { testId } = await params;
  const docs = await getDocs({ body: { entity_id: testId } });
  return { title: docs.detail.title, description: docs.detail.description };
}

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

  try {
    const testData = await getTestArtifact(testId);

    return (
      <TestChat
        test_id={testId}
        test_data={testData}
        draft_id={draftId ?? null}
      />
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
