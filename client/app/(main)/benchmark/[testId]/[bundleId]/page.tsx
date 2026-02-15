import BenchmarkBundle, {
  type BenchmarkBundleData,
} from "@/components/artifacts/benchmark/BenchmarkBundle";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type GetBenchmarkBundleOut = OutputOf<
  "/api/v4/artifacts/benchmark/get",
  "post"
>;
type PatchBenchmarkDraftIn = InputOf<
  "/api/v4/artifacts/benchmark/draft",
  "patch"
>;
type PatchBenchmarkDraftOut = OutputOf<
  "/api/v4/artifacts/benchmark/draft",
  "patch"
>;

const getBenchmarkBundle = async (
  bundleId: string,
  draftId: string | null,
): Promise<GetBenchmarkBundleOut> => {
  return api.post(
    "/artifacts/benchmark/get",
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
  return api.patch("/artifacts/benchmark/draft", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Customize Benchmark",
    description: "Customize resources for a benchmark run.",
  };
}

export default async function BenchmarkBundlePage({
  params,
  searchParams,
}: {
  params: Promise<{ testId: string; bundleId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { testId, bundleId } = await params;
  const sp = await searchParams;
  const rawDraftId = sp["draftId"];
  const draftId =
    typeof rawDraftId === "string"
      ? rawDraftId
      : Array.isArray(rawDraftId)
        ? (rawDraftId[0] ?? null)
        : null;

  const bundleData = await getBenchmarkBundle(bundleId, draftId);

  return (
    <BenchmarkBundle
      bundleData={bundleData as BenchmarkBundleData}
      testId={testId}
      patchBenchmarkDraftAction={patchBenchmarkDraft}
    />
  );
}
