/**
 * EvalCard.tsx
 * Eval card component for benchmark page
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */

import TableRubric from "@/components/artifacts/rubric/TableRubric";
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
import { cn } from "@/lib/utils";
import {
  Loader2,
  Play,
  Table,
  User,
  Infinity,
} from "lucide-react";
// ProfileItem type derived from server response (single source of truth)
import type { ProfileItem } from "@/app/(main)/layout-server";

export interface EvalCardProps {
  evalId: string;
  name: string;
  description: string;
  status: string; // 'pending', 'running', 'completed'
  totalRuns: number;
  completedRuns: number;
  pendingRuns: number;
  rubricName: string;
  useGroups?: boolean; // Show infinity icon if true
  onStartEval: (evalId: string) => void;
  onStartInfiniteMode?: ((evalId: string) => void) | undefined;
  loadingEval: string | null;
  profile: ProfileItem;
  // Rubric data for dialog
  standard_groups?: Record<string, string[]>;
  standardGroupsMapping?: Record<
    string,
    { name: string; description: string; points: number; passPoints: number }
  >;
  standardsMapping?: Record<
    string,
    { name: string; description: string; points: number }
  >;
}

export default function EvalCard({
  evalId,
  name,
  description,
  status: _status,
  totalRuns: _totalRuns,
  completedRuns: _completedRuns,
  pendingRuns: _pendingRuns,
  rubricName: _rubricName,
  useGroups = false,
  onStartEval,
  onStartInfiniteMode,
  loadingEval,
  profile,
  standard_groups,
  standardGroupsMapping,
  standardsMapping,
}: EvalCardProps) {
  const isLoading = loadingEval === evalId;
  const isDisabled = isLoading;

  // Use default User icon
  const IconComponent = User;

  // Default gradient for eval cards (purple theme)
  const backgroundGradient = "from-gray-900 to-gray-600";

  return (
    <div className="relative h-full">
      <Card
        data-testid={`eval-card-${evalId}`}
        data-eval-id={evalId}
        className="group relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 bg-white dark:bg-gray-900 border-0 shadow-lg rounded-lg flex flex-col h-full"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none select-none rounded-lg">
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-br rounded-lg",
              backgroundGradient
            )}
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
            <div className="flex flex-col items-end space-y-1 flex-1 min-h-[40px] justify-between">
              {/* Rubric Icon */}
              {standard_groups &&
                Object.keys(standard_groups).length > 0 && (
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
                        This dialog shows the rubric for the eval.
                      </DialogDescription>
                      <DialogHeader>
                        <DialogTitle>Grading Rubric: {name}</DialogTitle>
                      </DialogHeader>
                      <div
                        className="overflow-x-auto -mx-6 px-6"
                        style={{ WebkitOverflowScrolling: "touch" }}
                      >
                        {standard_groups &&
                        standardGroupsMapping &&
                        standardsMapping ? (
                          <TableRubric
                            standardGroups={standard_groups}
                            standardGroupsMapping={standardGroupsMapping}
                            standardsMapping={standardsMapping}
                            showFullStandardsOnMobile={true}
                          />
                        ) : (
                          <p className="text-sm text-gray-500">
                            No rubric is associated with this eval.
                          </p>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
            </div>
          </div>
        </CardHeader>

        {/* Make content take up remaining space, but not push footer off */}
        <CardContent className="space-y-1 relative z-10 flex-1 flex flex-col justify-start">
          <div className="flex flex-col justify-between h-full">
            <h3
              className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors"
              data-testid="eval-title"
            >
              {name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
              {description}
            </p>
          </div>
        </CardContent>

        <CardFooter className="pt-0 relative z-10">
            <div className="flex items-center gap-2 w-full">
              <Button
                onClick={() => onStartEval(evalId)}
                disabled={isDisabled}
                className="flex-1 font-medium text-sm hover:shadow-lg transition-all duration-300"
                variant="default"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Eval
                  </>
                )}
              </Button>
              {onStartInfiniteMode && useGroups && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => onStartInfiniteMode(evalId)}
                      disabled={isDisabled}
                      variant="default"
                      size="icon"
                      className="flex-shrink-0 hover:scale-105 transition-all duration-300"
                      data-testid={`start-infinite-${evalId}`}
                    >
                      <Infinity className="h-4 w-4 text-white" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Infinite Mode</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export function EvalCardSkeleton() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex gap-2 mt-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
      <CardFooter>
        <Skeleton className="h-10 w-full" />
      </CardFooter>
    </Card>
  );
}

