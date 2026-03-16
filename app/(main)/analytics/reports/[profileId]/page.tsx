import { redirect } from "next/navigation";

export default async function ReportsProfileRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { profileId } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(sp)) {
    if (typeof val === "string") qs.set(key, val);
    else if (Array.isArray(val)) val.forEach((v) => v && qs.append(key, v));
  }
  const query = qs.toString();
  redirect(`/record/${profileId}${query ? `?${query}` : ""}`);
}

/** ---- Re-export types for backward compatibility ---- */
export type {
  GetProfileOut,
  ReportHistoryIn,
  ReportHistoryOut,
  ReportsOverviewIn,
  ReportsOverviewOut,
} from "@/app/(main)/record/[recordId]/page";
