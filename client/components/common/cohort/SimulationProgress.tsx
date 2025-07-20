/**
 * SimulationProgress.tsx
 * This component displays a horizontal progress bar for a single simulation
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckCircle2, CircleDashed, Loader } from "lucide-react";

interface SimulationProgressProps {
  simulation: {
    id: string;
    title: string;
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
  const completionPercent =
    Math.round((progress.passedCount / progress.totalMembers) * 100) || 0;

  const segments = [
    {
      count: progress.passedCount,
      color: "bg-green-500",
      status: "Passed",
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    {
      count: progress.inProgressCount,
      color: "bg-yellow-500",
      status: "In Progress",
      icon: <Loader className="h-4 w-4 animate-spin" />,
    },
    {
      count: progress.notStartedCount,
      color: "bg-gray-300 dark:bg-gray-700",
      status: "Not Started",
      icon: <CircleDashed className="h-4 w-4" />,
    },
  ];

  return (
    <div className="flex flex-col space-y-2 w-full">
      <div className="flex justify-between items-center">
        <h4
          className="font-semibold text-sm truncate flex-1"
          title={simulation.title}
        >
          {simulation.title}
        </h4>
        <span className="text-sm font-medium text-primary ml-2">
          {completionPercent}%
        </span>
      </div>
      <div
        className="flex h-4 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden"
        data-testid="progress-bar"
      >
        <TooltipProvider>
          {segments.map(
            (segment, index) =>
              segment.count > 0 && (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <div
                      className={`${segment.color} transition-all duration-500`}
                      style={{
                        width: `${(segment.count / progress.totalMembers) * 100}%`,
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="flex items-center space-x-2">
                      {segment.icon}
                      <p>
                        {segment.count} member(s) - {segment.status}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
          )}
        </TooltipProvider>
      </div>
    </div>
  );
}
