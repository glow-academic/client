/**
 * app/(main)/create/personas/new/page.tsx
 * New persona page for the personas section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import NewPersona from "@/components/create/personas/NewPersona";

import { auth } from "@/auth";
import { personasDetailDefaultKeys } from "@/lib/api/v2/keys";
import { fetchPersonaDetailDefault } from "@/lib/api/v2/server/personas";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Persona",
  description: `New persona creation page for the personas section in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function NewPersonaPage() {
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  const queryClient = getQueryClient();

  // Prefetch default persona detail for instant hydration
  await queryClient.prefetchQuery({
    queryKey: personasDetailDefaultKeys.detail(profileId),
    queryFn: () => fetchPersonaDetailDefault(profileId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <NewPersona />
      </div>
    </HydrationBoundary>
  );
}
