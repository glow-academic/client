import { redirect } from "next/navigation";

export default async function PricingGroupRedirect({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  redirect(`/group/${groupId}`);
}

/** ---- Re-export types for backward compatibility ---- */
export type {
  PricingGroupDetailIn,
  PricingGroupDetailOut,
} from "@/app/(main)/group/[groupId]/page";
