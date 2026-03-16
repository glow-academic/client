import { redirect } from "next/navigation";

export default async function ActivitySessionRedirect({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  redirect(`/session/${sessionId}`);
}

/** ---- Re-export types for backward compatibility ---- */
export type {
  SessionDetailIn,
  SessionDetailOut,
} from "@/app/(main)/session/[sessionId]/page";
