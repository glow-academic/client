import { redirect } from "next/navigation";

export default async function BenchmarkSuiteRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ testId: string; suiteId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { testId, suiteId } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  qs.set("testId", testId);
  for (const [key, val] of Object.entries(sp)) {
    if (typeof val === "string") qs.set(key, val);
    else if (Array.isArray(val)) val.forEach((v) => v && qs.append(key, v));
  }
  redirect(`/invocation/${suiteId}?${qs.toString()}`);
}
