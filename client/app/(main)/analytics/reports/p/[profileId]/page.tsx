/**
 * app/(main)/analytics/reports/p/[profileId]/page.tsx
 * Reports page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { use } from "react";

import Report from "@/components/analytics/report/Report";
import { profileRepo } from "@/lib/repos/profileRepo";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ profileId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  // read route params
  const { profileId } = await params;

  const profile = await profileRepo.find(profileId);

  return {
    title: `${profile?.firstName} ${profile?.lastName}`,
    description: `Reports for individual staff in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
  };
}

export default function ReportsPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = use(params);
  return (
    <div className="space-y-6">
      <Report profileId={profileId} />
    </div>
  );
}
