import EvalCard, { EvalCardSkeleton } from "@/components/benchmark/EvalCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";

// ProfileItem type derived from server response (single source of truth)
import type { ProfileItem } from "@/app/(main)/layout-server";
import type { OutputOf } from "@/lib/api/types";

// Extract types from API response (single source of truth)
type EvalsListOut = OutputOf<"/api/v4/evals/list", "post">;
type EvalItem = EvalsListOut["evals"][number];

// Rubric mapping types
type RubricMapping = {
  standard_groups: Record<string, string[]>;
  standardGroupsMapping: Record<
    string,
    { name: string; description: string; points: number; passPoints: number }
  >;
  standardsMapping: Record<
    string,
    { name: string; description: string; points: number }
  >;
};

interface BenchmarkZoneProps {
  evals: EvalItem[];
  profile: ProfileItem | null;
  onStartEval: (evalId: string) => void;
  onStartInfiniteMode?: ((evalId: string) => void) | undefined;
  loadingEval: string | null;
  rubricMappings?: Record<string, RubricMapping> | undefined; // keyed by rubric_id
}

export default function BenchmarkZone({
  evals,
  profile,
  onStartEval,
  onStartInfiniteMode,
  loadingEval,
  rubricMappings,
}: BenchmarkZoneProps) {
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Carousel logic
  const maxVisible = 3;
  const totalPages = Math.ceil((evals?.length || 0) / maxVisible);
  const canScrollLeft = carouselIndex > 0;
  const canScrollRight = carouselIndex < totalPages - 1;

  const handlePrevious = useCallback(() => {
    if (canScrollLeft) {
      setCarouselIndex(carouselIndex - 1);
    }
  }, [canScrollLeft, carouselIndex]);

  const handleNext = useCallback(() => {
    if (canScrollRight) {
      setCarouselIndex(carouselIndex + 1);
    }
  }, [canScrollRight, carouselIndex]);

  if (!evals || evals.length === 0) return null;

  // Get evals for current page
  const startIndex = carouselIndex * maxVisible;
  const endIndex = startIndex + maxVisible;
  const visibleEvals = evals.slice(startIndex, endIndex);

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevious}
              disabled={!canScrollLeft}
              className={`p-2 rounded-lg transition-colors ${
                canScrollLeft
                  ? "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                  : "bg-gray-50 text-gray-300 dark:bg-gray-900 dark:text-gray-600 cursor-not-allowed"
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {carouselIndex + 1} of {totalPages}
            </span>
            <button
              onClick={handleNext}
              disabled={!canScrollRight}
              className={`p-2 rounded-lg transition-colors ${
                canScrollRight
                  ? "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                  : "bg-gray-50 text-gray-300 dark:bg-gray-900 dark:text-gray-600 cursor-not-allowed"
              }`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Carousel container */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        data-testid="benchmark-eval-grid"
      >
        {visibleEvals.map((evalItem) => {
          const rubricMapping = rubricMappings?.[evalItem.rubric_id];
          return (
            profile && (
              <EvalCard
                key={evalItem.eval_id}
                evalId={evalItem.eval_id}
                name={evalItem.name}
                description={evalItem.description}
                status={evalItem.status}
                totalRuns={evalItem.total_runs}
                completedRuns={evalItem.completed_runs}
                pendingRuns={evalItem.pending_runs}
                rubricName={evalItem.rubric_name}
                useGroups={evalItem.use_groups || false}
                onStartEval={onStartEval}
                {...(onStartInfiniteMode && { onStartInfiniteMode })}
                loadingEval={loadingEval}
                effectiveProfile={profile}
                {...(rubricMapping?.standard_groups && { standard_groups: rubricMapping.standard_groups })}
                {...(rubricMapping?.standardGroupsMapping && { standardGroupsMapping: rubricMapping.standardGroupsMapping })}
                {...(rubricMapping?.standardsMapping && { standardsMapping: rubricMapping.standardsMapping })}
              />
            )
          );
        })}
      </div>

      {/* Dots indicator */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2 mt-4">
          {Array.from({ length: totalPages }, (_, index) => (
            <button
              key={index}
              onClick={() => setCarouselIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === carouselIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function BenchmarkZoneSkeleton() {
  const CARD_COUNT = 3;

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>

      {/* Carousel container */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: CARD_COUNT }).map((_, index) => (
          <EvalCardSkeleton key={`benchmark-card-${index}`} />
        ))}
      </div>

      {/* Dots indicator */}
      <div className="flex justify-center space-x-2 mt-4">
        {Array.from({ length: CARD_COUNT }).map((_, index) => (
          <Skeleton
            key={`benchmark-dot-${index}`}
            className={`h-2 rounded-full ${index === 0 ? "w-6" : "w-2"}`}
          />
        ))}
      </div>
    </div>
  );
}
