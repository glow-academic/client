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
  };
}

export default function SimulationProgress({
  simulation,
}: SimulationProgressProps) {
  const { progress } = simulation;

  // Calculate completion percentage
  const totalCompleted = progress.passedCount + progress.inProgressCount;
  const completionPercentage =
    progress.totalMembers > 0
      ? Math.round((totalCompleted / progress.totalMembers) * 100)
      : 0;

  return (
    <div
      className="flex items-center space-x-4"
      data-testid="simulation-progress"
    >
      {/* Title and Progress Bar in flex layout */}
      <div className="flex-1 flex items-center space-x-4">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-0 flex-1">
          {simulation.title}
        </span>

        {/* Progress Bar */}
        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>

        {/* Percentage */}
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[3rem] text-right">
          {completionPercentage}%
        </span>
      </div>
    </div>
  );
}
