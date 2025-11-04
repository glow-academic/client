import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";
import SimulationCard from "@/components/common/layout/SimulationCard";

type ProfileItem = {
  id: string;
  firstName: string;
  lastName: string;
  alias: string;
  role: "superadmin" | "admin" | "instructional" | "ta" | "guest";
  active: boolean;
  viewedIntro: boolean;
  viewedChat: boolean;
  defaultProfile: boolean;
  reqPerDay: number | null;
  lastLogin: string;
  lastActive: string | null;
  createdAt: string;
  updatedAt: string;
  primaryDepartmentId: string | null;
};

type PracticeSimulationItem = {
  viewMode: "practice";
  id: string;
  simulationTitle: string;
  simulationDescription: string | null;
  simulationName: string;
  timeLimit?: number | null;
  numSessions: number;
  highestScore?: number | null;
  standard_groups: Record<string, string[]>;
  rubric_id?: string | null;
  color?: string | null;
  icon?: string | null;
  hasPassed?: boolean | null;
  passRate?: number | null;
  status?: "not-started" | "in-progress" | "passed" | null;
  completionPct?: number | null;
  passedCount?: number | null;
  inProgressCount?: number | null;
  notStartedCount?: number | null;
  passPct?: number | null;
  cohortName?: string | null;
  updatedAt?: string | null;
  lastActivityTs?: string | null;
  hasActivity?: boolean | null;
};

type StandardGroupMappingItem = {
  name: string;
  description: string;
  points: number;
  passPoints: number;
};

type StandardMappingItem = {
  name: string;
  description: string;
  points: number;
};

type StandardGroupsMapping = Record<string, StandardGroupMappingItem>;
type StandardsMapping = Record<string, StandardMappingItem>;

interface PracticeZoneProps {
  simulations: PracticeSimulationItem[];
  standardGroupsMapping: StandardGroupsMapping;
  standardsMapping: StandardsMapping;
  profile: ProfileItem | null;
  onStartSimulation: (simulationId: string) => void;
  loadingSimulation: string | null;
}

export default function PracticeZone({
  simulations,
  standardGroupsMapping,
  standardsMapping,
  profile,
  onStartSimulation,
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleSimulations.map(
          (simulation) =>
            profile && (
              <SimulationCard
                key={simulation.id}
                id={simulation.id}
                {...(typeof simulation.timeLimit === "number" && {
                  timeLimit: simulation.timeLimit,
                })}
                numSessions={simulation.numSessions}
                {...(typeof simulation.highestScore === "number" && {
                  highestScore: simulation.highestScore,
                })}
                simulationTitle={simulation.simulationTitle}
                simulationDescription={simulation.simulationDescription || ""}
                standard_groups={simulation.standard_groups}
                standardGroupsMapping={standardGroupsMapping}
                standardsMapping={standardsMapping}
                {...(simulation.color && { color: simulation.color })}
                {...(simulation.icon && { icon: simulation.icon })}
                {...(typeof simulation.hasPassed === "boolean" && {
                  hasPassed: simulation.hasPassed,
                })}
                // Removed passRate for practice cards to prevent fallback to rubric threshold
                type="default"
                onStartSimulation={onStartSimulation}
                loadingSimulation={loadingSimulation}
                effectiveProfile={profile}
              />
            )
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
                index === carouselIndex
                  ? "bg-blue-500"
                  : "bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
