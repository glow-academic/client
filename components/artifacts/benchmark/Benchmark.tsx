/**
 * Benchmark.tsx
 * Benchmark page for the user.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */
"use client";
import type { EvalsListOut } from "@/app/(main)/benchmark/page";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useTestStart } from "@/hooks/use-test-start";
import BenchmarkZone, { BenchmarkZoneSkeleton } from "./BenchmarkZone";
// Rubric mapping types
type RubricMapping = {
  standard_groups: Record<string, string[]>;
  standardGroupsMapping: Record<
    string,
    { name: string; description: string; points: number; passPoints: number }
  >;
  standardsMapping: Record<
    string,
    { name: string; description: string; points: number }
  >;
};

export interface BenchmarkProps {
  evalsData: EvalsListOut;
  rubricMappings?: Record<string, RubricMapping>; // keyed by rubric_id
}

export default function Benchmark({
  evalsData,
  rubricMappings,
}: BenchmarkProps) {
  const { profile } = useProfile();
  const { start, stage, error } = useTestStart();

  const [startingEvalId, setStartingEvalId] = useState<string | null>(null);
  const [loadingToastId, setLoadingToastId] = useState<string | number | null>(
    null
  );

  const loadingEval =
    stage === "starting" || stage === "loading" || stage === "running"
      ? startingEvalId
      : null;

  // React to terminal stages — dismiss the loading toast and clear state.
  useEffect(() => {
    if (stage === "ready" || stage === "lobby") {
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
        setLoadingToastId(null);
      }
      setStartingEvalId(null);
      toast.success("Eval started successfully.");
    } else if (stage === "error") {
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
        setLoadingToastId(null);
      }
      setStartingEvalId(null);
      toast.error(error || "Failed to start eval. Please try again.");
    }
  }, [stage, error, loadingToastId]);

  // Extract evals list from data
  const evalsList = useMemo(() => {
    const evals = evalsData?.evals || [];
    return evals.map((evalItem) => ({
      ...evalItem,
      use_groups: (evalItem as { use_groups?: boolean | null }).use_groups ?? false,
    }));
  }, [evalsData?.evals]);

  const handleStartEval = useCallback(
    async (evalId: string, infiniteMode: boolean = false) => {
      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        return;
      }

      const toastId = toast.loading(
        infiniteMode ? "Starting infinite mode eval..." : "Starting eval...",
        { dismissible: true },
      );
      setLoadingToastId(toastId);
      setStartingEvalId(evalId);

      await start({ evalId, infiniteMode });
    },
    [profile, start],
  );

  const handleStartInfiniteMode = useCallback(
    async (evalId: string) => {
      await handleStartEval(evalId, true);
    },
    [handleStartEval]
  );

  if (!profile) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="space-y-12">
        <BenchmarkZone
          evals={evalsList}
          profile={{
            ...profile,
            role: profile.role as
              | "member"
              | "instructional"
              | "superadmin"
              | "admin"
              | "guest",
          }}
          onStartEval={handleStartEval}
          onStartInfiniteMode={handleStartInfiniteMode}
          loadingEval={loadingEval}
          rubricMappings={rubricMappings}
        />
      </div>
    </TooltipProvider>
  );
}

export function BenchmarkSkeleton() {
  return (
    <div className="space-y-12">
      <BenchmarkZoneSkeleton />
    </div>
  );
}
