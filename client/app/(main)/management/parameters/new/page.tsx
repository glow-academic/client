/**
 * app/(main)/management/parameters/new/page.tsx
 * New parameter page for the parameters section.
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import { auth } from "@/auth";
import NewParameter from "@/components/common/parameter/Parameter";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { getQueryClient } from "@/utils/queryClient";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Parameter",
  description: `New parameter creation page for the parameters section in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function NewParameterPage() {
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";
  const queryClient = getQueryClient();

  // Prefetch default parameter detail data (for create mode)
  await queryClient.prefetchQuery({
    queryKey: keys.parameters.with({ profileId }),
    queryFn: () =>
      api.post("/parameters/detail-default", {
        body: { profileId },
      }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <NewParameter mode="create" />
      </div>
    </HydrationBoundary>
  );
}
