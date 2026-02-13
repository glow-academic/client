import BenchmarkBundle, {
  type BenchmarkBundleData,
} from "@/components/artifacts/benchmark/BenchmarkBundle";
import { api } from "@/lib/api/client";
import type { OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type GetBenchmarkBundleOut = OutputOf<
  "/api/v4/artifacts/benchmark/bundle/get",
  "post"
>;

const getBenchmarkBundle = async (
  bundleId: string,
): Promise<GetBenchmarkBundleOut> => {
  return api.post(
    "/artifacts/benchmark/bundle/get",
    {
      body: {
        benchmark_bundle_entry_id: bundleId,
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

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Customize Benchmark",
    description: "Customize resources for a benchmark run.",
  };
}

export default async function BenchmarkBundlePage({
  params,
}: {
  params: Promise<{ testId: string; bundleId: string }>;
}) {
  const { testId, bundleId } = await params;

  const bundleData = await getBenchmarkBundle(bundleId);

  return <BenchmarkBundle bundleData={bundleData as BenchmarkBundleData} testId={testId} />;
}
