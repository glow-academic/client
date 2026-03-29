/**
 * app/(main)/invocation/[invocationId]/page.tsx
 * Canonical invocation page (benchmark bundle customization).
 * @AshokSaravanan222 & @siladiea
 * 02/2025
 */

import Invocation, {
  type InvocationData,
} from "@/components/artifacts/invocation/Invocation";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
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

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Customize Benchmark",
    description: "Customize resources for a benchmark run.",
  };
}

export default async function InvocationPage({
  params,
  searchParams,
}: {
  params: Promise<{ invocationId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { invocationId } = await params;
  const sp = await searchParams;
  const rawDraftId = sp["draftId"];
  const draftId =
    typeof rawDraftId === "string"
      ? rawDraftId
      : Array.isArray(rawDraftId)
        ? (rawDraftId[0] ?? null)
        : null;

  const rawTestId = sp["testId"];
  const testId =
    typeof rawTestId === "string"
      ? rawTestId
      : Array.isArray(rawTestId)
        ? (rawTestId[0] ?? null)
        : null;

  const bundleData = await getBenchmarkBundle(invocationId, draftId);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { title: "Invocation" },
        ]}
      />
      <div className="px-4">
        <Invocation
          bundleData={bundleData as InvocationData}
          testId={testId ?? ""}
          patchBenchmarkDraftAction={patchBenchmarkDraft}
        />
      </div>
    </>
  );
}
