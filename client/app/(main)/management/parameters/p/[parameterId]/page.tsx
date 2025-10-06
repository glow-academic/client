/**
 * app/(main)/management/parameters/p/[parameterId]/page.tsx
 * Parameter edit page for the parameter page.
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import EditParameter from "@/components/common/parameter/Parameter";
import { parameterRepo } from "@/lib/repos/parameterRepo";
import type { Metadata, ResolvingMetadata } from "next";
import { use } from "react";

export async function generateMetadata(
  { params }: { params: Promise<{ parameterId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { parameterId } = await params;
  const parameter = await parameterRepo.find(parameterId);
  return {
    title: `${parameter?.name || "Parameter"} Parameter`,
    description: `${parameter?.name + " " + parameter?.description || "Parameter"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
  };
}

export default function ParameterEditPage({
  params,
}: {
  params: Promise<{ parameterId: string }>;
}) {
  const { parameterId } = use(params);
  return (
    <div className="space-y-6">
      <EditParameter parameterId={parameterId} mode="edit" />
    </div>
  );
}
