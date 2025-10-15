/**
 * app/(main)/management/parameters/p/[parameterId]/page.tsx
 * Parameter edit page for the parameter page.
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import { auth } from "@/auth";
import EditParameter from "@/components/common/parameter/Parameter";
import { parametersDetailKeys } from "@/lib/api/v2/keys";
import { fetchParameterDetail } from "@/lib/api/v2/server/parameters";
import { parameterRepo } from "@/lib/repos/parameterRepo";
import { getQueryClient } from "@/utils/react-query/queryClient";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ parameterId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { parameterId } = await params;
  const parameter = await parameterRepo.find(parameterId);
  return {
    title: `${parameter?.name || "Parameter"} Parameter`,
    description: `${parameter?.name + " " + parameter?.description || "Parameter"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
  };
}

export default async function ParameterEditPage({
  params,
}: {
  params: Promise<{ parameterId: string }>;
}) {
  const { parameterId } = await params;
  const session = await auth();
  const queryClient = getQueryClient();

  // Prefetch parameter detail data
  await queryClient.prefetchQuery({
    queryKey: parametersDetailKeys.detail(
      parameterId,
      session?.effectiveProfileId || ""
    ),
    queryFn: () =>
      fetchParameterDetail(parameterId, session?.effectiveProfileId || ""),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <EditParameter parameterId={parameterId} mode="edit" />
      </div>
    </HydrationBoundary>
  );
}
