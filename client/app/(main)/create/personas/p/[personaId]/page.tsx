/**
 * app/(main)/create/personas/p/[personaId]/page.tsx
 * Persona edit page for the persona page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { auth } from "@/auth";
import Persona from "@/components/common/agent/Persona";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ personaId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { personaId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  try {
    const persona = await api.post("/personas/detail", {
      body: { personaId, profileId },
    });
    return {
      title: `${persona?.name || "Persona"} Persona`,
      description: `${persona ? `${persona.name} ${persona.description || ""}` : "Persona"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Persona",
      description: `Persona in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
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
    queryKey: keys.personas.with({ personaId, profileId }),
    queryFn: () =>
      api.post("/personas/detail", {
        body: { personaId, profileId },
      }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <Persona personaId={personaId} mode="edit" />
      </div>
    </HydrationBoundary>
  );
}
