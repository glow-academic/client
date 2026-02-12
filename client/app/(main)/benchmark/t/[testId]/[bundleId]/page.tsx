import BenchmarkBundle, {
  type BenchmarkBundleData,
} from "@/components/artifacts/benchmark/BenchmarkBundle";
import { api } from "@/lib/api/client";
import type { Metadata } from "next";

const getBenchmarkBundle = async (
  bundleId: string,
): Promise<BenchmarkBundleData> => {
  const response = await api.post(
    "/artifacts/benchmark/bundle/get" as never,
    {
      body: {
        benchmark_bundle_entry_id: bundleId,
      },
    } as never,
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
  return response as BenchmarkBundleData;
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

  return <BenchmarkBundle bundleData={bundleData} testId={testId} />;
}
