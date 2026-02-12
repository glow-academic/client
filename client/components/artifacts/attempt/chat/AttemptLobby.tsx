"use client";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/contexts/profile-context";
import type { ServerToClientEvents } from "@/lib/ws/types";
import { Play, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface AttemptLobbyProps {
  attemptId: string;
  trainingBundleEntryId: string;
  simulationName: string | null;
  mode: "home" | "practice";
  draftId: string | null;
  infiniteMode?: boolean;
  userInstructions?: string | null;
}

export function AttemptLobby({
  attemptId,
  trainingBundleEntryId,
  simulationName,
  mode,
  draftId,
  infiniteMode,
  userInstructions,
}: AttemptLobbyProps) {
  const router = useRouter();
  const { socket, isConnected } = useProfile();
  const [isStarting, setIsStarting] = useState(false);

  // Listen for training_started to refresh the page (chat will appear)
  useEffect(() => {
    if (!socket) return;

    const handleStarted = (
      data: Parameters<ServerToClientEvents["training_started"]>[0]
    ) => {
      if (!isStarting) return;
      setIsStarting(false);
      if (data.attempt_id === attemptId) {
        router.refresh();
      }
    };

    const handleError = (
      data: Parameters<ServerToClientEvents["training_error"]>[0]
    ) => {
      if (!isStarting) return;
      setIsStarting(false);
      toast.error(data.message || "Failed to start training.");
    };

    socket.on("training_started", handleStarted);
    socket.on("training_error", handleError);

    return () => {
      socket.off("training_started", handleStarted);
      socket.off("training_error", handleError);
    };
  }, [socket, isStarting, attemptId, router]);

  const handleStart = useCallback(() => {
    if (!socket || !isConnected) {
      toast.error("WebSocket not connected. Please refresh the page.");
      return;
    }

    setIsStarting(true);

    const payload: Record<string, unknown> = {
      training_bundle_entry_id: trainingBundleEntryId,
      attempt_id: attemptId,
    };

    if (draftId) {
      payload.draft_id = draftId;
    }
    if (infiniteMode) {
      payload.infinite = true;
    }
    if (userInstructions?.trim()) {
      payload.user_instructions = [userInstructions.trim()];
    }

    socket.emit("training_start", payload);
  }, [socket, isConnected, trainingBundleEntryId, attemptId, draftId, infiniteMode, userInstructions]);

  const handleCustomize = useCallback(() => {
    const basePath = mode === "practice" ? "/practice" : "/home";
    router.push(`${basePath}/${attemptId}/${trainingBundleEntryId}`);
  }, [mode, router, attemptId, trainingBundleEntryId]);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">
          {simulationName || "Training Simulation"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Ready to begin your training session.
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={handleStart}
          disabled={isStarting || !isConnected}
          size="lg"
          className="gap-2"
        >
          <Play className="h-4 w-4" />
          {isStarting ? "Starting..." : "Start"}
        </Button>
        <Button
          onClick={handleCustomize}
          disabled={isStarting}
          variant="outline"
          size="lg"
          className="gap-2"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Customize
        </Button>
      </div>
    </div>
  );
}
