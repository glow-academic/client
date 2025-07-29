/**
 * SimulationProgress.tsx
 * Component to display progress for a simulation
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { Simulation } from "@/types";

interface SimulationProgressProps {
  simulation: Simulation & {
    progress: {
      totalMembers: number;
      passedCount: number;
      inProgressCount: number;
      notStartedCount: number;
      passedMembers: string[];
      inProgressMembers: string[];
    };
    cohort?: {
      id: string;
      title: string;
      description: string | null;
    };
  };
}

export default function SimulationProgress({
  simulation,
}: SimulationProgressProps) {
  const { progress } = simulation;

  // Validate progress data to ensure consistency
  const validatedProgress = {
    totalMembers: Math.max(0, progress.totalMembers),
    passedCount: Math.max(
      0,
      Math.min(progress.passedCount, progress.totalMembers)
    ),
    inProgressCount: Math.max(
      0,
      Math.min(
        progress.inProgressCount,
        progress.totalMembers - progress.passedCount
      )
    ),
    notStartedCount: Math.max(0, progress.notStartedCount),
    passedMembers: progress.passedMembers || [],
    inProgressMembers: progress.inProgressMembers || [],
  };

  // Calculate completion percentage (capped at 100%)
  const totalCompleted =
    validatedProgress.passedCount + validatedProgress.inProgressCount;
  const completionPercentage =
    validatedProgress.totalMembers > 0
      ? Math.min(
          100,
          Math.round((totalCompleted / validatedProgress.totalMembers) * 100)
        )
      : 0;

  // Determine if all members have passed (for instructor view)
  const allPassed =
    validatedProgress.passedCount >= validatedProgress.totalMembers;
  const isComplete = allPassed;

  // Get status text and color
  const getStatusInfo = () => {
    if (isComplete) {
      return {
        text: "Complete",
        color: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-100 dark:bg-green-900/20",
        borderColor: "border-green-200 dark:border-green-800",
      };
    } else if (validatedProgress.passedCount > 0) {
      return {
        text: "In Progress",
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-100 dark:bg-blue-900/20",
        borderColor: "border-blue-200 dark:border-blue-800",
      };
    } else {
      return {
        text: "Not Started",
        color: "text-gray-600 dark:text-gray-400",
        bgColor: "bg-gray-100 dark:bg-gray-900/20",
        borderColor: "border-gray-200 dark:border-gray-800",
      };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div
      className={`flex items-center space-x-4 p-3 rounded-lg border ${statusInfo.bgColor} ${statusInfo.borderColor}`}
      data-testid="simulation-progress"
    >
      {/* Title and Cohort Name */}
      <div className="min-w-0 flex-shrink-0 w-64">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
          {simulation.title}
        </span>
        {simulation.cohort && (
          <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">
            {simulation.cohort.title}
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            isComplete
              ? "bg-green-500"
              : validatedProgress.passedCount > 0
                ? "bg-blue-500"
                : "bg-gray-400"
          }`}
          style={{ width: `${completionPercentage}%` }}
        />
      </div>

      {/* Status and Percentage */}
      <div className="flex items-center space-x-2 min-w-[8rem]">
        <span
          className={`text-xs font-medium px-2 py-1 rounded-full border ${statusInfo.color} ${statusInfo.bgColor} ${statusInfo.borderColor}`}
        >
          {statusInfo.text}
        </span>
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {completionPercentage}%
        </span>
      </div>

      {/* Detailed counts */}
      <div className="text-xs text-gray-500 dark:text-gray-400 space-x-2">
        <span className="inline-flex items-center">
          <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
          {validatedProgress.passedCount} passed
        </span>
        {validatedProgress.inProgressCount > 0 && (
          <span className="inline-flex items-center">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
            {validatedProgress.inProgressCount} in progress
          </span>
        )}
        {validatedProgress.notStartedCount > 0 && (
          <span className="inline-flex items-center">
            <span className="w-2 h-2 bg-gray-400 rounded-full mr-1"></span>
            {validatedProgress.notStartedCount} not started
          </span>
        )}
      </div>
    </div>
  );
}
