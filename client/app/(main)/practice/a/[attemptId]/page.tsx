/**
 * app/practice/a/[attemptId]/page.tsx
 * Attempt page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import AttemptChat from "@/components/common/chat/attempt/AttemptChat";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ attemptId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { attemptId } = await params;

  try {
    const attemptData = await api.post("/attempts/full", {
      body: { attemptId },
    });
    const simulationTitle = attemptData?.simulation?.["title"];
    return {
      title: `Practice ${simulationTitle || "Attempt"}`,
      description: `Practice ${simulationTitle || "Attempt"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: `Practice Attempt ${attemptId.substring(0, 8)}...`,
      description: `Practice Attempt ${attemptId.substring(0, 8)}... in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

export default async function PracticeAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;

  const queryClient = getQueryClient();

  // Prefetch attempt full data for instant hydration
  await queryClient.prefetchQuery({
    queryKey: keys.attempts.with({ attemptId }),
    queryFn: () =>
      api.post("/attempts/full", {
        body: { attemptId },
      }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <AttemptChat />
      </div>
    </HydrationBoundary>
  );
}
