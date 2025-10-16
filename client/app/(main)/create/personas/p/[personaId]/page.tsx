/**
 * app/(main)/create/personas/p/[personaId]/page.tsx
 * Persona edit page for the persona page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import PersonaEdit from "@/components/create/personas/PersonaEdit";

import { auth } from "@/auth";
import { personasDetailKeys } from "@/lib/api/v2/keys";
import { fetchPersonaDetail } from "@/lib/api/v2/server/personas";
import { personaRepo } from "@/lib/repos/personaRepo";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ personaId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { personaId } = await params;
  const persona = await personaRepo.find(personaId);
  return {
    title: `${persona?.name || "Persona"} Persona`,
    description: `${persona?.name + " " + persona?.description || "Persona"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
  };
}

export default async function PersonaEditPage({
  params,
}: {
  params: Promise<{ personaId: string }>;
}) {
  const { personaId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  const queryClient = getQueryClient();

  // Prefetch persona detail for instant hydration
  await queryClient.prefetchQuery({
    queryKey: personasDetailKeys.detail(personaId, profileId),
    queryFn: () => fetchPersonaDetail(personaId, profileId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <PersonaEdit personaId={personaId} />
      </div>
    </HydrationBoundary>
  );
}
