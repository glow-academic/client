/**
 * app/(main)/management/providers/p/[providerId]/new/page.tsx
 * New model page for the providers section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import NewModel from "@/components/system/providers/NewModel";
import { getProvider } from "@/utils/queries/providers/get-provider";

import type { Metadata, ResolvingMetadata } from "next";
import { use } from "react";

export async function generateMetadata(
  { params }: { params: Promise<{ providerId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { providerId } = await params;

  const provider = await getProvider(providerId);

  return {
    title: `${provider?.name || "Provider"} Models`,
    description:
      provider?.description ||
      `Manage individual AI models for ${provider?.name} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
  };
}

export default function NewModelPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = use(params);

  return (
    <div className="space-y-6">
      <NewModel providerId={providerId} />
    </div>
  );
}
