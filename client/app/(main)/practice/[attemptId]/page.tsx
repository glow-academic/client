import { redirect } from "next/navigation";

export default async function PracticeAttemptRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ attemptId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { attemptId } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(sp)) {
    if (typeof val === "string") qs.set(key, val);
    else if (Array.isArray(val)) val.forEach((v) => v && qs.append(key, v));
  }
  const query = qs.toString();
  redirect(`/attempt/${attemptId}${query ? `?${query}` : ""}`);
}

/** ---- Re-export types for backward compatibility ---- */
export type {
  AttemptDetailIn,
  AttemptDetailOut,
} from "@/app/(main)/attempt/[attemptId]/page";
