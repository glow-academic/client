/**
 * app/(main)/management/parameters/new/page.tsx
 * New parameter page for the parameters section.
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import { auth } from "@/auth";
import NewParameter from "@/components/common/parameter/Parameter";
import { parametersDetailDefaultKeys } from "@/lib/api/v2/keys";
import { fetchParameterDetailDefault } from "@/lib/api/v2/server/parameters";
import { getQueryClient } from "@/utils/queryClient";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Parameter",
  description: `New parameter creation page for the parameters section in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function NewParameterPage() {
  const session = await auth();
  const queryClient = getQueryClient();

  // Prefetch default parameter detail data (for create mode)
  await queryClient.prefetchQuery({
    queryKey: parametersDetailDefaultKeys.detail(
      session?.effectiveProfileId || ""
    ),
    queryFn: () =>
      fetchParameterDetailDefault(session?.effectiveProfileId || ""),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <NewParameter mode="create" />
      </div>
    </HydrationBoundary>
  );
}
