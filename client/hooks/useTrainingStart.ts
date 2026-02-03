/**
 * Hook for starting training sessions via WebSocket.
 *
 * Provides a unified interface for starting simulations in both Home and Practice modes.
 * Uses the training_start socket event and listens for training_started/training_error responses.
 *
 * The hook:
 * - Gets socket connection and agent_id from profile context
 * - Emits training_start event with simulation_id, agent_id, and optional scenario_id
 * - Manages loading state during the start process
 * - Handles success/error events and navigation
 */
"use client";

import { useProfile } from "@/contexts/profile-context";
import type { ServerToClientEvents } from "@/lib/ws/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface UseTrainingStartOptions {
  /** Called when training starts successfully with the attempt ID */
  onSuccess?: (attemptId: string) => void;
  /** Called when training fails to start */
  onError?: (message: string) => void;
  /** Whether this is practice mode (affects navigation path) */
  practice?: boolean;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
}

interface UseTrainingStartReturn {
  /** Start a training session for the given simulation */
  startTraining: (params: {
    simulationId: string;
    scenarioId?: string | null;
    infinite?: boolean;
  }) => void;
  /** Whether a training start is in progress */
  isStarting: boolean;
  /** The simulation ID currently being started (null if not starting) */
  startingSimulationId: string | null;
  /** Whether the socket is connected */
  isConnected: boolean;
  /** Whether training agent is available */
  hasTrainingAgent: boolean;
}

export function useTrainingStart(
  options: UseTrainingStartOptions = {}
): UseTrainingStartReturn {
  const { onSuccess, onError, practice = false, timeout = 30000 } = options;

  const router = useRouter();
  const { socket, isConnected, artifactAgentIds } = useProfile();

  const [isStarting, setIsStarting] = useState(false);
  const [startingSimulationId, setStartingSimulationId] = useState<
    string | null
  >(null);
  const [loadingToastId, setLoadingToastId] = useState<string | number | null>(
    null
  );
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get the training agent ID from profile context
  const trainingAgentId = artifactAgentIds?.training ?? null;
  const hasTrainingAgent = trainingAgentId !== null;

  // Cleanup function for timeout and toast
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (loadingToastId) {
      toast.dismiss(loadingToastId);
      setLoadingToastId(null);
    }
  }, [loadingToastId]);

  // Handle training_started event
  useEffect(() => {
    if (!socket) return;

    const handleTrainingStarted = (
      data: Parameters<ServerToClientEvents["training_started"]>[0]
    ) => {
      cleanup();
      setIsStarting(false);
      setStartingSimulationId(null);

      if (data.success && data.attempt_id) {
        toast.success(data.message || "Training started successfully");

        // Call success callback if provided
        if (onSuccess) {
          onSuccess(data.attempt_id);
        }

        // Refresh current page data so it's updated when user returns
        router.refresh();

        // Navigate to the attempt page
        const basePath = practice ? "/practice" : "/home";
        router.push(`${basePath}/a/${data.attempt_id}`);

        // Dispatch custom event for other components
        window.dispatchEvent(
          new CustomEvent("trainingStarted", {
            detail: { attemptId: data.attempt_id },
          })
        );
      } else {
        const errorMessage = data.message || "Failed to start training";
        toast.error(errorMessage);
        if (onError) {
          onError(errorMessage);
        }
      }
    };

    const handleTrainingError = (
      data: Parameters<ServerToClientEvents["training_error"]>[0]
    ) => {
      cleanup();
      setIsStarting(false);
      setStartingSimulationId(null);

      const errorMessage = data.message || "Training error occurred";
      toast.error(errorMessage);

      if (onError) {
        onError(errorMessage);
      }

      // Dispatch custom event for other components
      window.dispatchEvent(new CustomEvent("trainingError"));
    };

    // Subscribe to events
    socket.on("training_started", handleTrainingStarted);
    socket.on("training_error", handleTrainingError);

    // Cleanup
    return () => {
      socket.off("training_started", handleTrainingStarted);
      socket.off("training_error", handleTrainingError);
    };
  }, [socket, onSuccess, onError, practice, router, cleanup]);

  // Start training function
  const startTraining = useCallback(
    (params: {
      simulationId: string;
      scenarioId?: string | null;
      infinite?: boolean;
    }) => {
      const { simulationId, scenarioId, infinite } = params;

      // Validate socket connection
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected. Please refresh the page.");
        if (onError) {
          onError("WebSocket not connected");
        }
        return;
      }

      // Validate training agent
      if (!trainingAgentId) {
        toast.error(
          "Training agent not available. Please contact your administrator."
        );
        if (onError) {
          onError("Training agent not available");
        }
        return;
      }

      // Set loading state
      setIsStarting(true);
      setStartingSimulationId(simulationId);

      // Show loading toast
      const toastId = toast.loading(
        infinite ? "Starting infinite mode..." : "Starting simulation...",
        { dismissible: true }
      );
      setLoadingToastId(toastId);

      // Build payload
      const payload: Record<string, unknown> = {
        simulation_id: simulationId,
        agent_id: trainingAgentId,
      };

      // Add optional scenario_id
      if (scenarioId) {
        payload.scenario_id = scenarioId;
      }

      // Add infinite mode flag
      if (infinite) {
        payload.infinite = true;
      }

      // Emit the training_start event
      socket.emit("training_start", payload);

      // Set up timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        cleanup();
        setIsStarting(false);
        setStartingSimulationId(null);
        toast.error("Training start timed out. Please try again.");
        if (onError) {
          onError("Training start timed out");
        }
      }, timeout);
    },
    [socket, isConnected, trainingAgentId, onError, timeout, cleanup]
  );

  return {
    startTraining,
    isStarting,
    startingSimulationId,
    isConnected,
    hasTrainingAgent,
  };
}

export default useTrainingStart;
