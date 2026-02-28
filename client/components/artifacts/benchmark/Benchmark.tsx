/**
 * Benchmark.tsx
 * Benchmark page for the user.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */
"use client";
import type { EvalsListOut } from "@/app/(main)/benchmark/page";
import { useRouter } from "next/navigation";
import React, { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useSocket } from "@/contexts/socket-context";
import { useTestLifecycle } from "@/hooks/use-test-lifecycle";
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
  const router = useRouter();

  const { profile } = useProfile();

  const { socket, isConnected } = useSocket();
  const [startingEvalId, setStartingEvalId] = useState<string | null>(null);

  // Use WebSocket's specific eval ID for precise loading state
  const loadingEval = startingEvalId;
  const [loadingToastId, setLoadingToastId] = useState<string | number | null>(
    null
  );
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const { startTest } = useTestLifecycle({
    socket,
    onStarted: (data) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
        setLoadingToastId(null);
      }
      setStartingEvalId(null);

      toast.success("Eval started successfully.");
      router.refresh();
      router.push(`/test/${data.test_id}`);
    },
    onError: (data) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
        setLoadingToastId(null);
      }
      setStartingEvalId(null);
      toast.error(data.message || "Failed to start eval. Please try again.");
    },
  });

  // Extract evals list from data
  const evalsList = useMemo(() => {
    const evals = evalsData?.evals || [];
    // Add missing use_groups property if not present
    return evals.map((evalItem) => ({
      ...evalItem,
      use_groups: (evalItem as { use_groups?: boolean | null }).use_groups ?? false,
    }));
  }, [evalsData?.evals]);

  const handleStartEval = useCallback(
    async (evalId: string, infiniteMode: boolean = false) => {
      try {
        if (!profile?.id) {
          toast.error("Profile not loaded. Please refresh the page.");
          return;
        }

        if (!isConnected || !socket) {
          toast.error(
            "WebSocket not connected. Please wait for connection or refresh the page."
          );
          return;
        }

        const toastId = toast.loading(
          infiniteMode ? "Starting infinite mode eval..." : "Starting eval...",
          {
            dismissible: true,
          }
        );
        setLoadingToastId(toastId);
        setStartingEvalId(evalId);

        startTest(evalId, { infiniteMode });

        // timeout...
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          toast.dismiss(toastId);
          toast.error("Eval start timed out. Please try again.");
          setLoadingToastId(null);
          setStartingEvalId(null);
        }, 60000); // 60 seconds timeout for evals
      } catch {
        if (loadingToastId) toast.dismiss(loadingToastId);
        toast.error("Failed to start eval. Please try again.");
        setLoadingToastId(null);
        setStartingEvalId(null);
      }
    },
    [
      profile,
      isConnected,
      socket,
      loadingToastId,
      startTest,
    ]
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
