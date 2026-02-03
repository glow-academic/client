/**
 * SimulationCard.tsx
 * This is the simulation card component for the home page
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";

import TableRubric from "@/components/common/rubric/TableRubric";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import type { ServerToClientEvents } from "@/lib/ws/types";
import { getPersonaIconComponent } from "@/utils/persona-icons";
import { Infinity, Info, Table, Timer, User, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
// ProfileItem type derived from server response (single source of truth)
import type { ProfileItem } from "@/app/(main)/layout-server";

// Extract types from API response (single source of truth)
// Note: Practice component transforms arrays to mappings before passing to SimulationCard
type StandardGroupsMapping = Record<string, {
  name: string;
  description: string;
  points: number;
  passPoints: number;
}>;
type StandardsMapping = Record<string, {
  name: string;
  description: string;
  points: number;
}>;

const generateGradientFromHex = (hexColor: string): string => {
  // Remove # if present
  const cleanHex = hexColor.replace("#", "");

  // Convert to RGB
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  // Create a lighter variant for the gradient (brighter like simulation cards)
  const lighterR = Math.min(255, r + 60);
  const lighterG = Math.min(255, g + 60);
  const lighterB = Math.min(255, b + 60);

  // Convert back to hex
  const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;

  return `linear-gradient(135deg, ${lighterHex} 0%, ${hexColor} 100%)`;
};

export interface SimulationCardProps {
  id: string;
  timeLimit?: number;
  numSessions: number;
  highestScore?: number;
  simulationTitle: string;
  simulationDescription: string;
  standard_groups: Record<string, string[]>;
  standardGroupsMapping: StandardGroupsMapping;
  standardsMapping: StandardsMapping;
  color?: string;
  icon?: string;
  hasPassed?: boolean;
  passRate?: number;
  /** "default" = practice mode, "cohort" = home mode */
  type: "default" | "cohort";
  profile: ProfileItem;
  /** Whether to show infinite mode button (practice only) */
  showInfiniteMode?: boolean;
}

export default function SimulationCard({
  id,
  timeLimit,
  numSessions,
  highestScore,
  simulationTitle,
  simulationDescription,
  standard_groups,
  standardGroupsMapping,
  standardsMapping,
  color,
  icon,
  hasPassed,
  passRate,
  type,
  profile,
  showInfiniteMode = false,
}: SimulationCardProps) {
  const router = useRouter();
  const { socket, isConnected, artifactAgentIds } = useProfile();

  // Determine if this is practice mode based on type
  const practice = type === "default";

  // Loading state for this card
  const [isStarting, setIsStarting] = useState(false);
  const [loadingToastId, setLoadingToastId] = useState<string | number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get the training agent ID from profile context
  const trainingAgentId = artifactAgentIds?.["training"] ?? null;

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

  // Handle training_started and training_error events
  useEffect(() => {
    if (!socket) return;

    const handleTrainingStarted = (
      data: Parameters<ServerToClientEvents["training_started"]>[0]
    ) => {
      // Only handle if this card initiated the start
      if (!isStarting) return;

      cleanup();
      setIsStarting(false);

      // Receiving this event means success - navigate to the attempt
      if (data.attempt_id) {
        toast.success("Training started successfully");

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
      }
    };

    const handleTrainingError = (
      data: Parameters<ServerToClientEvents["training_error"]>[0]
    ) => {
      // Only handle if this card initiated the start
      if (!isStarting) return;

      cleanup();
      setIsStarting(false);

      const errorMessage = data.message || "Training error occurred";
      toast.error(errorMessage);

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
  }, [socket, isStarting, practice, router, cleanup]);

  // Start training function
  const handleStartTraining = useCallback(
    (infinite: boolean = false) => {
      // Validate socket connection
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      // Validate training agent
      if (!trainingAgentId) {
        toast.error(
          "Training agent not available. Please contact your administrator."
        );
        return;
      }

      // Set loading state
      setIsStarting(true);

      // Show loading toast
      const toastId = toast.loading(
        infinite ? "Starting infinite mode..." : "Starting simulation...",
        { dismissible: true }
      );
      setLoadingToastId(toastId);

      // Build payload
      const payload: Record<string, unknown> = {
        simulation_id: id,
        agent_id: trainingAgentId,
      };

      // Add infinite mode flag
      if (infinite) {
        payload["infinite"] = true;
      }

      // Emit the training_start event
      socket.emit("training_start", payload);

      // Dispatch event for analytics
      window.dispatchEvent(
        new CustomEvent("simulationButtonPressed", {
          detail: { simulationId: id },
        })
      );

      // Set up timeout (30 seconds)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        cleanup();
        setIsStarting(false);
        toast.error("Training start timed out. Please try again.");
      }, 30000);
    },
    [socket, isConnected, trainingAgentId, id, cleanup]
  );

  // Get persona configuration and icon based on persona data
  const IconComponent =
    type === "default" ? (icon ? getPersonaIconComponent(icon) : User) : Users;

  // Determine gradient class based on completion status and persona color
  const getGradientClass = () => {
    if (hasPassed && type !== "default") {
      return "from-green-500 to-green-600";
    }
    if (type === "default" && color) {
      // Use the provided color to generate gradient
      const gradientStyle = generateGradientFromHex(color);
      return gradientStyle;
    }
    // Use primary color gradient as fallback (via Button default variant styling)
    return type === "default" ? color || null : null;
  };

  const gradientClass = getGradientClass();
  // For cohort simulations (non-practice), use status-based colors
  // For practice simulations (default), use color prop or default purple
  const iconColor =
    type === "cohort"
      ? hasPassed
        ? "#22c55e" // green-500 when passed
        : "#9333ea" // purple-600 when not passed
      : color
        ? color.startsWith("#")
          ? color
          : `#${color}`
        : "rgb(168, 85, 247)"; // purple-500 default for practice

  const backgroundGradient =
    type === "cohort" && hasPassed
      ? "from-green-900 to-green-600"
      : "from-gray-900 to-gray-600";

  // Determine if we should use persona color for icons (only for default type with color prop)
  const shouldUsePersonaColor = type === "default" && color;

  // Make the card fill available height and stretch the header to create space
  return (
    <div className="relative h-full">
      <Card
        data-testid={
          type === "default"
            ? "permanent-simulation-card"
            : `simulation-card-${id}`
        }
        data-simulation-id={id}
        className="group relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 bg-white dark:bg-gray-900 border-0 shadow-lg rounded-lg flex flex-col h-full"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none select-none rounded-lg">
          <div
            className={`absolute inset-0 bg-gradient-to-br ${backgroundGradient} rounded-lg`}
          ></div>
          <div
            className="absolute inset-0 rounded-lg"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)",
              backgroundSize: "20px 20px",
            }}
          ></div>
        </div>

        <CardHeader className="pb-1 relative z-10">
          <div className="flex items-start justify-between">
            {gradientClass ? (
              <div
                className={`p-2 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0 ${
                  typeof gradientClass === "string" &&
                  !gradientClass.startsWith("linear-gradient")
                    ? `bg-gradient-to-br ${gradientClass}`
                    : ""
                }`}
                style={{
                  minHeight: 40,
                  minWidth: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ...(typeof gradientClass === "string" &&
                    gradientClass.startsWith("linear-gradient") && {
                      background: gradientClass,
                    }),
                }}
              >
                <IconComponent className="h-5 w-5 text-white" />
              </div>
            ) : (
              <Button
                variant="default"
                size="icon"
                className="rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0"
                style={{
                  minHeight: 40,
                  minWidth: 40,
                }}
              >
                <IconComponent className="h-5 w-5" />
              </Button>
            )}
            <div className="flex flex-col items-end space-y-1 flex-1 min-h-[40px] justify-between">
              {/* Rubric Icon */}
              {profile?.role !== "guest" && (
                <Dialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="relative z-20"
                        >
                          <Table className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View Rubric</p>
                    </TooltipContent>
                  </Tooltip>
                  <DialogContent className="max-w-4xl">
                    <DialogDescription hidden>
                      This dialog shows the rubric for the simulation.
                    </DialogDescription>
                    <DialogHeader>
                      <DialogTitle>
                        Grading Rubric: {simulationTitle}
                        {passRate && passRate > 0 && ` (${passRate}% to pass)`}
                      </DialogTitle>
                    </DialogHeader>
                    <div
                      className="overflow-x-auto -mx-6 px-6"
                      style={{ WebkitOverflowScrolling: "touch" }}
                    >
                      {standard_groups &&
                      Object.keys(standard_groups).length > 0 ? (
                        <TableRubric
                          standardGroups={standard_groups}
                          standardGroupsMapping={standardGroupsMapping}
                          standardsMapping={standardsMapping}
                          showFullStandardsOnMobile={true}
                        />
                      ) : (
                        <p className="text-sm text-gray-500">
                          No rubric is associated with this simulation.
                        </p>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              {profile?.role === "guest" && (
                <div className="text-right">
                  <div
                    className="text-xs font-medium text-gray-500 dark:text-gray-400"
                    data-testid={
                      type === "default"
                        ? "simulation-type"
                        : "simulation-class"
                    }
                  >
                    {type === "default" ? "Default" : "Cohort"}
                  </div>
                  <div className="text-xs text-gray-400">
                    {type === "default" ? "Simulation" : "Simulations"}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Make content take up remaining space, but not push footer off */}
        <CardContent className="space-y-1 relative z-10 flex-1 flex flex-col justify-start">
          <div className="flex flex-col justify-between h-full">
            <h3
              className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors"
              data-testid="simulation-title"
            >
              {simulationTitle}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
              {simulationDescription}
            </p>
          </div>

          <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400 mt-2">
            <div
              className="flex items-center"
              data-testid="simulation-duration"
            >
              <Timer className="h-3 w-3 mr-1" />
              <span>{timeLimit ? `${timeLimit}` : "∞"} min</span>
            </div>
            <div className="flex items-center">
              {type === "default" ? (
                <User className="h-3 w-3 mr-1" />
              ) : (
                <Users className="h-3 w-3 mr-1" />
              )}
              <span>
                {type === "default"
                  ? "1 session"
                  : `${numSessions} session${numSessions !== 1 ? "s" : ""}`}
              </span>
            </div>
            {profile?.role !== "guest" &&
              highestScore !== undefined &&
              highestScore !== null &&
              highestScore > 0 && (
                <div className="flex items-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center">
                        <Info className="h-3 w-3 mr-1" />
                        <span>{highestScore}%</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Your highest score</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
          </div>
        </CardContent>

        <CardFooter className="pt-0 relative z-10">
          {type === "default" &&
            showInfiniteMode &&
            profile?.role !== "guest" ? (
            <div className="flex gap-2 w-full">
              <Button
                onClick={() => handleStartTraining(false)}
                disabled={isStarting}
                data-testid={`start-simulation-${id}`}
                variant={gradientClass ? undefined : "default"}
                className={`flex-1 hover:shadow-lg transition-all duration-300 ${
                  isStarting ? "animate-pulse" : "hover:scale-105"
                } ${
                  typeof gradientClass === "string" &&
                  gradientClass !== null &&
                  !gradientClass.startsWith("linear-gradient")
                    ? `bg-gradient-to-r ${gradientClass} text-white border-0 hover:opacity-90`
                    : typeof gradientClass === "string" &&
                        gradientClass.startsWith("linear-gradient")
                      ? "border-0"
                      : ""
                }`}
                style={{
                  ...(typeof gradientClass === "string" &&
                    gradientClass.startsWith("linear-gradient") && {
                      background: gradientClass,
                      color: "white",
                      border: "none",
                    }),
                }}
              >
                {isStarting ? "Starting..." : "Start Simulation"}
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => handleStartTraining(true)}
                    disabled={isStarting}
                    variant="default"
                    size="icon"
                    className="flex-shrink-0 hover:scale-105 transition-all duration-300"
                    data-testid={`start-infinite-${id}`}
                    style={
                      shouldUsePersonaColor
                        ? {
                            backgroundColor: iconColor,
                            borderColor: iconColor,
                            color: "white",
                          }
                        : undefined
                    }
                  >
                    <Infinity className={`h-4 w-4 text-white`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Infinite Mode</p>
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <Button
              onClick={() => handleStartTraining(false)}
              disabled={isStarting}
              data-testid={`start-simulation-${id}`}
              variant={gradientClass ? undefined : "default"}
              className={`w-full hover:shadow-lg transition-all duration-300 ${
                isStarting ? "animate-pulse" : "hover:scale-105"
              } ${
                typeof gradientClass === "string" &&
                gradientClass !== null &&
                !gradientClass.startsWith("linear-gradient")
                  ? `bg-gradient-to-r ${gradientClass} text-white border-0 hover:opacity-90`
                  : typeof gradientClass === "string" &&
                      gradientClass.startsWith("linear-gradient")
                    ? "border-0"
                    : ""
              }`}
              style={{
                ...(typeof gradientClass === "string" &&
                  gradientClass.startsWith("linear-gradient") && {
                    background: gradientClass,
                    color: "white",
                    border: "none",
                  }),
              }}
            >
              {isStarting
                ? "Starting..."
                : type === "default"
                  ? "Start Simulation"
                  : hasPassed
                    ? "Start Simulation (Complete)"
                    : "Start Simulation"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

export function SimulationCardSkeleton() {
  return (
    <div className="relative h-full">
      <Card className="group relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 bg-white dark:bg-gray-900 border-0 shadow-lg rounded-lg flex flex-col h-full">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none select-none rounded-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-600 rounded-lg"></div>
          <div
            className="absolute inset-0 rounded-lg"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)",
              backgroundSize: "20px 20px",
            }}
          ></div>
        </div>

        <CardHeader className="pb-1 relative z-10">
          <div className="flex items-start justify-between">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex flex-col items-end space-y-1 flex-1 min-h-[40px] justify-between">
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-1 relative z-10 flex-1 flex flex-col justify-start">
          <div className="flex flex-col justify-between h-full">
            <Skeleton className="h-6 w-48 mb-1" />
            <Skeleton className="h-4 w-full mt-1" />
            <Skeleton className="h-4 w-3/4 mt-1" />
          </div>

          <div className="flex items-center space-x-3 text-xs mt-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-12" />
          </div>
        </CardContent>

        <CardFooter className="pt-0 relative z-10">
          <Skeleton className="h-10 w-full rounded-lg" />
        </CardFooter>
      </Card>
    </div>
  );
}
