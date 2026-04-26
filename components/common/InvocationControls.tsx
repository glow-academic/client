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
import { useTransport } from "@/lib/transport/context";
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
  const transport = useTransport();

  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  const [stoppingLoading, setStoppingLoading] = useState(false);

  const { completeTest } = useTestLifecycle({
    transport,
    invocationId: currentInvocationId,
    onInvocationStopped: useCallback(() => {
      setStoppingLoading(false);
    }, []),
    onCompleted: useCallback(() => {
      setStoppingLoading(false);
    }, []),
    onError: useCallback((data: TestErrorEvent) => {
      setStoppingLoading(false);
      const message = data["message"] as string | undefined;
      if (message) toast.error(message);
    }, []),
  });

  // Stop Test = canonical whole-test completion (test.complete →
  // test_proceed with complete_all=True on the server, which runs the
  // remaining invocations/groups through their grading path and emits
  // artifacts.test.completed when done). The page-level TestChat picks
  // up the completed event and flips into rubric/graded view.
  const handleStop = useCallback(() => {
    if (!hasRunsOrGroups) {
      setConfirmStopOpen(true);
      return;
    }
    setStoppingLoading(true);
    completeTest(testId);
  }, [hasRunsOrGroups, testId, completeTest]);

  const handleConfirmStop = useCallback(() => {
    setConfirmStopOpen(false);
    setStoppingLoading(true);
    completeTest(testId);
  }, [testId, completeTest]);

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
