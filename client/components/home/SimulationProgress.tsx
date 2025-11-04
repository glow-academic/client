/**
 * SimulationProgress.tsx
 * Component to display progress for a simulation
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

export enum ViewMode {
  TA = "ta",
  INSTRUCTIONAL = "instructional",
}

interface SimulationProgressProps {
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
      className={`flex items-center space-x-4 p-3 rounded-lg border ${statusInfo.bgColor} ${statusInfo.borderColor}`}
      data-testid="simulation-progress"
    >
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
  );
}
