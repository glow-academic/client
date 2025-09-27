/**
 * app/(main)/management/staff/p/[profileId]/page.tsx
 * Staff edit page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import StaffEdit from "@/components/management/staff/StaffEdit";
import { profileRepo } from "@/lib/repos/profileRepo";
import type { Metadata, ResolvingMetadata } from "next";
import { use } from "react";

export async function generateMetadata(
  { params }: { params: Promise<{ profileId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { profileId } = await params;

  const staff = await profileRepo.find(profileId);

  return {
    title: `${staff?.firstName} ${staff?.lastName}`,
    description: `Manage individual staff in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
  };
}

export default function StaffEditPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = use(params);
  return (
    <div className="space-y-6">
      <StaffEdit profileId={profileId} />
    </div>
  );
}
