/**
 * Benchmark.tsx
 * Benchmark page for the user.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */
"use client";
import type { CreateTestIn, CreateTestOut, EvalsListOut } from "@/app/(main)/benchmark/page";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useSocket } from "@/contexts/socket-context";
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
  createTestAction?: (input: CreateTestIn) => Promise<CreateTestOut>;
}

export default function Benchmark({
  evalsData,
  rubricMappings,
  createTestAction,
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

  // Extract evals list from data
  const evalsList = useMemo(() => {
    const evals = evalsData?.evals || [];
    // Add missing use_groups property if not present
    return evals.map((evalItem) => ({
      ...evalItem,
      use_groups: (evalItem as { use_groups?: boolean | null }).use_groups ?? false,
    }));
  }, [evalsData?.evals]);

  // Set up eval-specific event listeners using global WebSocket
  useEffect(() => {
    if (!socket) return;

    // Listen for successful eval starts to handle navigation
    const handleEvalStarted = async (event: CustomEvent) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
        setLoadingToastId(null);
      }
      setStartingEvalId(null);
      const { attemptId } = event.detail;
      // Server-side Redis cache is already invalidated by the WebSocket handler
      router.refresh(); // Refresh current page data so it's updated when user returns
      router.push(`/benchmark/${attemptId}`);
    };

    // Listen for eval errors to reset loading state
    const handleEvalError = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
        setLoadingToastId(null);
      }
      setStartingEvalId(null);
      toast.error("Failed to start eval. Please try again.");
    };

    window.addEventListener(
      "evalStarted",
      handleEvalStarted as unknown as EventListener
    );
    window.addEventListener("evalError", handleEvalError);

    return () => {
      window.removeEventListener(
        "evalStarted",
        handleEvalStarted as unknown as EventListener
      );
      window.removeEventListener("evalError", handleEvalError);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [router, loadingToastId, socket, setStartingEvalId]);

  // Set up WebSocket listeners for eval events
  useEffect(() => {
    if (!socket) return;

    const handleBenchmarksStarted = (data: {
      success: boolean;
      message: string;
      attempt_id: string;
    }) => {
      setStartingEvalId(null);
      if (data.success) {
        toast.success(data.message);
        window.dispatchEvent(
          new CustomEvent("evalStarted", {
            detail: { attemptId: data.attempt_id },
          })
        );
      } else {
        toast.error(data.message);
        window.dispatchEvent(new CustomEvent("evalError"));
      }
    };

    const handleBenchmarksStartError = (data: {
      success: boolean;
      message: string;
    }) => {
      setStartingEvalId(null);
      toast.error(data.message);
      window.dispatchEvent(new CustomEvent("evalError"));
    };

    socket.on("benchmark_started", handleBenchmarksStarted);
    socket.on("benchmark_error", handleBenchmarksStartError);

    return () => {
      socket.off("benchmark_started", handleBenchmarksStarted);
      socket.off("benchmark_error", handleBenchmarksStartError);
    };
  }, [socket, setStartingEvalId]);

  const handleStartEval = useCallback(
    async (evalId: string, infiniteMode: boolean = false) => {
      try {
        if (!profile?.id) {
          toast.error("Profile not loaded. Please refresh the page.");
          return;
        }

        // Use REST endpoint if available
        if (createTestAction) {
          const toastId = toast.loading(
            infiniteMode ? "Starting infinite mode eval..." : "Starting eval...",
            { dismissible: true }
          );
          setLoadingToastId(toastId);
          setStartingEvalId(evalId);

          try {
            const result = await createTestAction({
              body: { eval_id: evalId, infinite_mode: infiniteMode },
            });

            toast.dismiss(toastId);
            setLoadingToastId(null);
            setStartingEvalId(null);

            if (result.test_id) {
              toast.success("Eval started successfully.");
              router.refresh();
              router.push(`/benchmark/${result.test_id}`);
            } else {
              toast.error("Failed to start eval. Please try again.");
            }
          } catch {
            toast.dismiss(toastId);
            toast.error("Failed to start eval. Please try again.");
            setLoadingToastId(null);
            setStartingEvalId(null);
          }
          return;
        }

        // Fallback to WebSocket
        if (!isConnected) {
          toast.error(
            "WebSocket not connected. Please wait for connection or refresh the page."
          );
          return;
        }

        if (!socket) {
          toast.error(
            "WebSocket socket not available. Please refresh the page."
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

        const profileIdForEmit = String(profile?.id || "");

        socket.emit("benchmark_start", {
          eval_id: evalId,
          profile_id: profileIdForEmit || null,
          infinite_mode: infiniteMode,
        });

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
      createTestAction,
      router,
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
