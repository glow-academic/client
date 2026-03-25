/**
 * InvocationControls.tsx
 * Controls for stopping test invocations during benchmark runs
 */
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useSocket } from "@/contexts/socket-context";
import { useTestLifecycle } from "@/hooks/use-test-lifecycle";
import type { TestErrorEvent } from "@/hooks/use-test-lifecycle";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export interface InvocationControlsProps {
  testId: string;
  currentInvocationId: string;
  hasRunsOrGroups: boolean;
}

export function InvocationControls({
  testId,
  currentInvocationId,
  hasRunsOrGroups,
}: InvocationControlsProps) {
  // testId available for endTest (needs test_id + run_id) if needed
  void testId;
  const { socket } = useSocket();

  // Confirmation dialog state
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);

  // Loading state for Stop button
  const [stoppingLoading, setStoppingLoading] = useState(false);

  // Listen for WebSocket lifecycle events to reset loading state
  const { stopTest } = useTestLifecycle({
    socket,
    invocationId: currentInvocationId,
    onStopped: useCallback(() => {
      setStoppingLoading(false);
    }, []),
    onAllComplete: useCallback(() => {
      setStoppingLoading(false);
    }, []),
    onError: useCallback((data: TestErrorEvent) => {
      setStoppingLoading(false);
      if (data.message) {
        toast.error(data.message);
      }
    }, []),
  });

  // Handle Stop button click
  const handleStop = useCallback(() => {
    // No runs or groups: show confirmation
    if (!hasRunsOrGroups) {
      setConfirmStopOpen(true);
      return;
    }

    // Has runs/groups: stop immediately
    setStoppingLoading(true);
    stopTest(currentInvocationId);
  }, [hasRunsOrGroups, currentInvocationId, stopTest]);

  // Confirm stop with no runs or groups
  const handleConfirmStop = useCallback(() => {
    if (!socket) {
      toast.error("WebSocket not connected. Please refresh the page.");
      return;
    }

    setConfirmStopOpen(false);
    setStoppingLoading(true);
    stopTest(currentInvocationId);
  }, [currentInvocationId, socket, stopTest]);

  return (
    <>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="default"
          onClick={handleStop}
          disabled={stoppingLoading}
          className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm relative overflow-visible"
        >
          {stoppingLoading ? "Stopping..." : "Stop Test"}
        </Button>
      </div>

      {/* Confirm Stop (no runs or groups) Dialog */}
      <AlertDialog
        open={confirmStopOpen}
        onOpenChange={setConfirmStopOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop test now?</AlertDialogTitle>
            <AlertDialogDescription>
              No runs or groups have been started for this invocation. Stopping
              now will end the test without any results.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmStop}>
              Stop Test
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
