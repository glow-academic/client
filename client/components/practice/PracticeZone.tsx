import SimulationCard, {
  SimulationCardSkeleton,
} from "@/components/common/layout/SimulationCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";

// ProfileItem type derived from server response (single source of truth)
import type { ProfileItem } from "@/app/(main)/layout-server";
import type { OutputOf } from "@/lib/api/types";

// Extract types from API response (single source of truth)
type PracticeOverviewOut = OutputOf<"/api/v4/analytics/practice/get", "post">;
type PracticeSimulationItem = NonNullable<PracticeOverviewOut["items"]>[number];
// API now returns arrays, but components expect dicts - define mapping types locally
type StandardGroupsMapping = Record<
  string,
  {
    name: string;
    description: string;
    points: number;
    passPoints: number;
  }
>;
type StandardsMapping = Record<
  string,
  { name: string; description: string; points: number }
>;

interface PracticeZoneProps {
  simulations: PracticeSimulationItem[];
  standardGroupsToStandards: Record<string, string[]>; // Mapping of standard_group_id -> array of standard_ids
  standardGroupsMapping: StandardGroupsMapping;
  standardsMapping: StandardsMapping;
  profile: ProfileItem | null;
  onStartSimulation: (simulationId: string) => void;
  onStartInfiniteMode?: (simulationId: string) => void;
  loadingSimulation: string | null;
}

export default function PracticeZone({
  simulations,
  standardGroupsToStandards,
  standardGroupsMapping,
  standardsMapping,
  profile,
  onStartSimulation,
  onStartInfiniteMode,
  loadingSimulation,
}: PracticeZoneProps) {
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Carousel logic
  const maxVisible = 3;
  const totalPages = Math.ceil((simulations?.length || 0) / maxVisible);
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

  if (!simulations || simulations.length === 0) return null;

  // Get simulations for current page
  const startIndex = carouselIndex * maxVisible;
  const endIndex = startIndex + maxVisible;
  const visibleSimulations = simulations.slice(startIndex, endIndex);

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
        data-testid="practice-simulation-grid"
      >
        {visibleSimulations.map(
          (simulation) => {
            if (!profile) return null;
            
            // Convert snake_case to camelCase for SimulationCard (shared component)
            const simulationId = simulation.simulation_id ? String(simulation.simulation_id) : "";
            
            // Build standard_groups dict from standard_groups array (IDs) and standardGroupsToStandards mapping
            const standardGroupsDict: Record<string, string[]> = {};
            if (simulation.standard_groups) {
              for (const sgId of simulation.standard_groups) {
                standardGroupsDict[sgId] = standardGroupsToStandards[sgId] || [];
              }
            }
            
            return (
              <SimulationCard
                key={simulationId}
                id={simulationId}
                {...(typeof simulation.time_limit === "number" && {
                  timeLimit: simulation.time_limit,
                })}
                numSessions={simulation.num_sessions || 0}
                {...(typeof simulation.highest_score === "number" && {
                  highestScore: simulation.highest_score,
                })}
                simulationTitle={simulation.simulation_title || ""}
                simulationDescription={simulation.simulation_description || ""}
                standard_groups={standardGroupsDict}
                standardGroupsMapping={standardGroupsMapping}
                standardsMapping={standardsMapping}
                {...(simulation.color && { color: simulation.color })}
                {...(simulation.icon && { icon: simulation.icon })}
                {...(typeof simulation.has_passed === "boolean" && {
                  hasPassed: simulation.has_passed,
                })}
                // Removed passRate for practice cards to prevent fallback to rubric threshold
                type="default"
                onStartSimulation={onStartSimulation}
                {...(onStartInfiniteMode && { onStartInfiniteMode })}
                loadingSimulation={loadingSimulation}
                effectiveProfile={profile}
              />
            );
          },
        )}
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

export function PracticeZoneSkeleton() {
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
          <SimulationCardSkeleton key={`practice-card-${index}`} />
        ))}
      </div>

      {/* Dots indicator */}
      <div className="flex justify-center space-x-2 mt-4">
        {Array.from({ length: CARD_COUNT }).map((_, index) => (
          <Skeleton
            key={`practice-dot-${index}`}
            className={`h-2 rounded-full ${index === 0 ? "w-6" : "w-2"}`}
          />
        ))}
      </div>
    </div>
  );
}
