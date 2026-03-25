import { redirect } from "next/navigation";

export default async function BenchmarkTestRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ testId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { testId } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(sp)) {
    if (typeof val === "string") qs.set(key, val);
    else if (Array.isArray(val)) val.forEach((v) => v && qs.append(key, v));
  }
  const query = qs.toString();
  redirect(`/test/${testId}${query ? `?${query}` : ""}`);
}

/** ---- Re-export types for backward compatibility ---- */
export type { TestArtifactOut } from "@/app/(main)/test/[testId]/page";
