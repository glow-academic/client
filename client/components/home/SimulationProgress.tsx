/**
 * SimulationProgress.tsx
 * Component to display progress for a simulation
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { Skeleton } from "@/components/ui/skeleton";

export enum ViewMode {
  TA = "ta",
  INSTRUCTIONAL = "instructional",
}

interface SimulationProgressProps {
  id: string;
  viewMode: ViewMode;
  cohortName?: string;
  simulationName: string;
  status: "not-started" | "in-progress" | "passed";
  completionPct: number;
  passedCount?: number;
  inProgressCount?: number;
  notStartedCount?: number;
  passPct?: number; // For TA mode
}

export default function SimulationProgress({
  id,
  viewMode,
  cohortName,
  simulationName,
  status,
  completionPct,
  passedCount,
  inProgressCount,
  notStartedCount,
  passPct,
}: SimulationProgressProps) {
  const isTAViewMode = viewMode === ViewMode.TA;
  const progressPercentage = completionPct;
  const isComplete = status === "passed";

  // Get status text and color
  const getStatusInfo = () => {
    if (isTAViewMode) {
      // TA view: show based on status
      if (status === "passed") {
        return {
          text: "Passed",
          color: "text-green-600 dark:text-green-400",
          bgColor: "bg-green-100 dark:bg-green-900/20",
          borderColor: "border-green-200 dark:border-green-800",
        };
      } else if (status === "in-progress") {
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
    } else {
      // Instructor view: show based on completion
      if (status === "passed") {
        return {
          text: "Complete",
          color: "text-green-600 dark:text-green-400",
          bgColor: "bg-green-100 dark:bg-green-900/20",
          borderColor: "border-green-200 dark:border-green-800",
        };
      } else if (status === "in-progress") {
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
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div
      className={`p-3 md:p-4 rounded-lg border ${statusInfo.bgColor} ${statusInfo.borderColor}`}
      data-testid={`simulation-progress-${id}`}
      data-simulation-id={id}
    >
      {/* Mobile Layout: Stacked */}
      <div className="flex flex-col md:hidden space-y-3">
        {/* Title and Cohort Name */}
        <div className="min-w-0">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
            {simulationName}
          </span>
          {cohortName && (
            <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">
              {cohortName}
            </span>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-300 ${
              isComplete
                ? "bg-green-500"
                : status === "in-progress"
                  ? "bg-blue-500"
                  : "bg-gray-400"
            }`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Status, Percentage, and Details Row */}
        <div className="flex flex-col space-y-2">
          {/* Status and Percentage */}
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusInfo.color} ${statusInfo.bgColor} ${statusInfo.borderColor}`}
            >
              {statusInfo.text}
            </span>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {progressPercentage}%
            </span>
          </div>

          {/* Detailed counts or pass threshold */}
          {isTAViewMode ? (
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <span className="inline-flex items-center">
                <span className="w-2 h-2 bg-orange-500 rounded-full mr-1.5"></span>
                {passPct || 70}% to pass
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-gray-600 dark:text-gray-400">
              <span className="inline-flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></span>
                {passedCount || 0} passed
              </span>
              {(inProgressCount || 0) > 0 && (
                <span className="inline-flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-1.5"></span>
                  {inProgressCount} in progress
                </span>
              )}
              {(notStartedCount || 0) > 0 && (
                <span className="inline-flex items-center">
                  <span className="w-2 h-2 bg-gray-400 rounded-full mr-1.5"></span>
                  {notStartedCount} not started
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Layout: Horizontal */}
      <div className="hidden md:flex items-center space-x-4">
        {/* Title and Cohort Name */}
        <div className="min-w-0 flex-shrink-0 w-64">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block">
            {simulationName}
          </span>
          {cohortName && (
            <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">
              {cohortName}
            </span>
          )}
        </div>

        {/* Progress Bar */}
        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              isComplete
                ? "bg-green-500"
                : status === "in-progress"
                  ? "bg-blue-500"
                  : "bg-gray-400"
            }`}
            style={{ width: `${progressPercentage}%` }}
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
            {progressPercentage}%
          </span>
        </div>

        {/* Detailed counts or pass threshold */}
        {isTAViewMode ? (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center">
              <span className="w-2 h-2 bg-orange-500 rounded-full mr-1"></span>
              {passPct || 70}% to pass
            </span>
          </div>
        ) : (
          <div className="text-xs text-gray-500 dark:text-gray-400 space-x-2">
            <span className="inline-flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
              {passedCount || 0} passed
            </span>
            {(inProgressCount || 0) > 0 && (
              <span className="inline-flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
                {inProgressCount} in progress
              </span>
            )}
            {(notStartedCount || 0) > 0 && (
              <span className="inline-flex items-center">
                <span className="w-2 h-2 bg-gray-400 rounded-full mr-1"></span>
                {notStartedCount} not started
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function SimulationProgressSkeleton() {
  return (
    <div className="p-3 md:p-4 rounded-lg border bg-card/40">
      {/* Mobile Layout: Stacked */}
      <div className="flex flex-col md:hidden space-y-3">
        {/* Title and Cohort Name */}
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-5 w-full max-w-56" />
          <Skeleton className="h-4 w-32" />
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <Skeleton className="h-2.5 w-3/4 rounded-full" />
        </div>

        {/* Status, Percentage, and Details */}
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-12" />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>

      {/* Desktop Layout: Horizontal */}
      <div className="hidden md:flex items-center space-x-4">
        {/* Title and Cohort Name */}
        <div className="min-w-0 flex-shrink-0 w-64 space-y-2">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-32" />
        </div>

        {/* Progress Bar */}
        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <Skeleton className="h-2 w-full rounded-full" />
        </div>

        {/* Status and Percentage */}
        <div className="flex items-center space-x-2 min-w-[8rem]">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-12" />
        </div>

        {/* Detailed counts */}
        <div className="text-xs space-x-2">
          <Skeleton className="h-4 w-20 inline-block" />
          <Skeleton className="h-4 w-24 inline-block" />
        </div>
      </div>
    </div>
  );
}
