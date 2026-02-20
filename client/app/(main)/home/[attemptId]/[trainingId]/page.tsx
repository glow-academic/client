import { redirect } from "next/navigation";

export default async function HomeTrainingRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ attemptId: string; trainingId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { attemptId, trainingId } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  qs.set("attemptId", attemptId);
  for (const [key, val] of Object.entries(sp)) {
    if (typeof val === "string") qs.set(key, val);
    else if (Array.isArray(val)) val.forEach((v) => v && qs.append(key, v));
  }
  redirect(`/chat/${trainingId}?${qs.toString()}`);
}
