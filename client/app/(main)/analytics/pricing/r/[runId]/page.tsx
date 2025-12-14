/**
 * app/(main)/analytics/pricing/r/[runId]/page.tsx
 * Pricing run detail page.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */

import { getSession } from "@/auth";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ runId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { runId } = await params;

  return {
    title: `Run ${runId.substring(0, 8)}...`,
    description:
      "Run details for teaching assistant training platform. Review cost analysis, usage metrics, and pricing data for educational institutions and L&D programs.",
  };
}

export default async function PricingRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;

  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  return <div className="space-y-6">{/* Content will be added later */}</div>;
}
