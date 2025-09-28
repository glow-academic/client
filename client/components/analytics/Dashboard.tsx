/**
 * Dashboard.tsx
 * Used to display the main dashboard for the analytics page.
 * Now fully dynamic using database components and dashboards.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/contexts/analytics-context";
import { useProfile } from "@/contexts/profile-context";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import ScenarioPerformance from "../common/analytics/footer/ScenarioPerformance";
import ScenarioStats from "../common/analytics/footer/ScenarioStats";
import SimulationComposition from "../common/analytics/footer/SimulationComposition";
import SimulationPerformance from "../common/analytics/footer/SimulationPerformance";
import AverageScore from "../common/analytics/header/AverageScore";
import CompletionPercentage from "../common/analytics/header/CompletionPercentage";
import FirstAttemptPassRate from "../common/analytics/header/FirstAttemptPassRate";
import HighestScore from "../common/analytics/header/HighestScore";
import MessagesPerSession from "../common/analytics/header/MessagesPerSession";
import PersonaResponseTimes from "../common/analytics/header/PersonaResponseTimes";
import SessionEfficiency from "../common/analytics/header/SessionEfficiency";
import StagnationRate from "../common/analytics/header/StagnationRate";
import TimeSpent from "../common/analytics/header/TimeSpent";
import TotalAttempts from "../common/analytics/header/TotalAttempts";
import Growth from "../common/analytics/primary/Growth";
import PersonaPerformance from "../common/analytics/primary/PersonaPerformance";
import RubricHeatmap from "../common/analytics/primary/RubricHeatmap";
import AttemptImprovement from "../common/analytics/secondary/AttemptImprovement";
import CohortPerformance from "../common/analytics/secondary/CohortPerformance";
import SkillPerformance from "../common/analytics/secondary/SkillPerformance";
import SimulationHistory from "../common/history/SimulationHistory";

interface DashboardProps {
  profileId?: string;
}

export default function Dashboard({ profileId }: DashboardProps) {
  const { effectiveProfile } = useProfile();

  const {
    startDate,
    endDate,
    selectedCohortIds,
    selectedRoles,
    simulationFilters,
  } = useAnalytics();

  // Threshold data
  const thresholds = {
    danger: 60,
    warning: 75,
    success: 85,
  };

  // Carousel states
  const [headerCarouselIndex, setHeaderCarouselIndex] = useState(0);
  const [primaryCarouselIndex, setPrimaryCarouselIndex] = useState(0);
  const [secondaryCarouselIndex, setSecondaryCarouselIndex] = useState(0);
  const [leftFooterCarouselIndex, setLeftFooterCarouselIndex] = useState(0);
  const [rightFooterCarouselIndex, setRightFooterCarouselIndex] = useState(0);

  // Hover states for arrow visibility
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [isPrimaryHovered, setIsPrimaryHovered] = useState(false);
  const [isSecondaryHovered, setIsSecondaryHovered] = useState(false);
  const [isLeftFooterHovered, setIsLeftFooterHovered] = useState(false);
  const [isRightFooterHovered, setIsRightFooterHovered] = useState(false);

  const headerComponents = [
    <AverageScore
      key="average-score"
      filters={{
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cohortIds: selectedCohortIds,
        roles: selectedRoles,
        simulationFilters,
      }}
      thresholds={thresholds}
    />,
    <CompletionPercentage
      key="completion-percentage"
      filters={{
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cohortIds: selectedCohortIds,
        roles: selectedRoles,
        simulationFilters,
      }}
      thresholds={thresholds}
    />,
    <FirstAttemptPassRate
      key="first-attempt-pass-rate"
      filters={{
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cohortIds: selectedCohortIds,
        roles: selectedRoles,
        simulationFilters,
      }}
      thresholds={thresholds}
    />,
    <HighestScore
      key="highest-score"
      filters={{
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cohortIds: selectedCohortIds,
        roles: selectedRoles,
        simulationFilters,
      }}
      thresholds={thresholds}
    />,
    <MessagesPerSession
      key="messages-per-session"
      filters={{
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cohortIds: selectedCohortIds,
        roles: selectedRoles,
        simulationFilters,
      }}
      thresholds={thresholds}
    />,
    <PersonaResponseTimes
      key="persona-response-times"
      filters={{
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cohortIds: selectedCohortIds,
        roles: selectedRoles,
        simulationFilters,
      }}
      thresholds={thresholds}
    />,
    <SessionEfficiency
      key="session-efficiency"
      filters={{
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cohortIds: selectedCohortIds,
        roles: selectedRoles,
        simulationFilters,
      }}
      thresholds={thresholds}
    />,
    <StagnationRate
      key="stagnation-rate"
      filters={{
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cohortIds: selectedCohortIds,
        roles: selectedRoles,
        simulationFilters,
      }}
      thresholds={thresholds}
    />,
    <TimeSpent
      key="time-spent"
      filters={{
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cohortIds: selectedCohortIds,
        roles: selectedRoles,
        simulationFilters,
      }}
      thresholds={thresholds}
    />,
    <TotalAttempts
      key="total-attempts"
      filters={{
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cohortIds: selectedCohortIds,
        roles: selectedRoles,
        simulationFilters,
      }}
      thresholds={thresholds}
    />,
  ];

  const primaryComponents = [
    <Growth key="growth" filters={{
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      cohortIds: selectedCohortIds,
      roles: selectedRoles,
      simulationFilters,
      profileId,
    }} />,
    <PersonaPerformance
      key="persona-performance"
      filters={{
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cohortIds: selectedCohortIds,
        roles: selectedRoles,
        simulationFilters,
      }}
      thresholds={thresholds}
    />,
    <RubricHeatmap
      key="rubric-heatmap"
      filters={{
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cohortIds: selectedCohortIds,
        roles: selectedRoles,
        simulationFilters,
      }}
    />,
  ];

  const secondaryComponents = [
    <CohortPerformance
      key="cohort-performance"
      filters={{
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cohortIds: selectedCohortIds,
        roles: selectedRoles,
        simulationFilters,
        profileId,
      }}
      thresholds={thresholds}
      profileId={profileId}
    />,
    <AttemptImprovement
      key="attempt-improvement"
      filters={{
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cohortIds: selectedCohortIds,
        roles: selectedRoles,
        simulationFilters,
        profileId,
      }}
      thresholds={thresholds}
    />,
    <SkillPerformance
      key="skill-performance"
      filters={{
        startDate: startDate.toISOString(), 
        endDate: endDate.toISOString(),
        cohortIds: selectedCohortIds,
        roles: selectedRoles,
        simulationFilters,
        profileId,
      }}
      thresholds={thresholds}
    />,
  ];

  const leftFooterComponents = [
    <ScenarioPerformance
      key="scenario-performance"
      filters={{
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cohortIds: selectedCohortIds,
        roles: selectedRoles,
        simulationFilters,
      }}
      thresholds={thresholds}
    />,
    <ScenarioStats
      key="scenario-stats"
      filters={{
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cohortIds: selectedCohortIds,
        roles: selectedRoles,
        simulationFilters,
      }}
      thresholds={thresholds}
    />,
  ];

  const rightFooterComponents = [
    <SimulationPerformance
      key="simulation-performance"
      filters={{
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cohortIds: selectedCohortIds,
        roles: selectedRoles,
        simulationFilters,
      }}
      thresholds={thresholds}
    />,
    <SimulationComposition
      key="simulation-composition"
      filters={{
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cohortIds: selectedCohortIds,
        roles: selectedRoles,
        simulationFilters,
      }}
      thresholds={thresholds}
    />,
  ];

  // Header pagination logic
  const HEADER_CARDS_PER_PAGE = 5;
  const totalHeaderPages = Math.ceil(
    headerComponents.length / HEADER_CARDS_PER_PAGE
  );

  const getVisibleHeaderComponents = () => {
    const startIndex = headerCarouselIndex * HEADER_CARDS_PER_PAGE;
    return headerComponents.slice(
      startIndex,
      startIndex + HEADER_CARDS_PER_PAGE
    );
  };

  // Navigation functions
  const navigateHeader = (direction: "prev" | "next") => {
    if (direction === "prev") {
      setHeaderCarouselIndex(
        (prev: number) => (prev - 1 + totalHeaderPages) % totalHeaderPages
      );
    } else {
      setHeaderCarouselIndex((prev: number) => (prev + 1) % totalHeaderPages);
    }
  };

  const navigatePrimary = (direction: "prev" | "next") => {
    const length = primaryComponents.length;
    if (length === 0) return;

    if (direction === "prev") {
      setPrimaryCarouselIndex((prev: number) => (prev - 1 + length) % length);
    } else {
      setPrimaryCarouselIndex((prev: number) => (prev + 1) % length);
    }
  };

  const navigateSecondary = (direction: "prev" | "next") => {
    const length = secondaryComponents.length;
    if (length === 0) return;

    if (direction === "prev") {
      setSecondaryCarouselIndex((prev: number) => (prev - 1 + length) % length);
    } else {
      setSecondaryCarouselIndex((prev: number) => (prev + 1) % length);
    }
  };

  const navigateLeftFooter = (direction: "prev" | "next") => {
    const length = leftFooterComponents.length;
    if (length === 0) return;

    if (direction === "prev") {
      setLeftFooterCarouselIndex(
        (prev: number) => (prev - 1 + length) % length
      );
    } else {
      setLeftFooterCarouselIndex((prev: number) => (prev + 1) % length);
    }
  };

  const navigateRightFooter = (direction: "prev" | "next") => {
    const length = rightFooterComponents.length;
    if (length === 0) return;

    if (direction === "prev") {
      setRightFooterCarouselIndex(
        (prev: number) => (prev - 1 + length) % length
      );
    } else {
      setRightFooterCarouselIndex((prev: number) => (prev + 1) % length);
    }
  };

  // Determine if user can archive (instructional, admin, superadmin)
  const canArchive =
    effectiveProfile?.role === "instructional" ||
    effectiveProfile?.role === "admin" ||
    effectiveProfile?.role === "superadmin";

  return (
    <div className="space-y-6">
      {/* Header Metrics with Dynamic Pagination */}
      {headerComponents.length > 0 && (
        <div className="space-y-4">
          <div
            className="relative group"
            onMouseEnter={() => setIsHeaderHovered(true)}
            onMouseLeave={() => setIsHeaderHovered(false)}
          >
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${Math.min(HEADER_CARDS_PER_PAGE, headerComponents.length)}, 1fr)`,
                gridAutoRows: "1fr",
              }}
            >
              {getVisibleHeaderComponents().map((component, index) => (
                <div
                  key={`header-${headerCarouselIndex}-${index}`}
                  className="transition-all duration-500 ease-in-out"
                >
                  {component}
                </div>
              ))}
            </div>

            {/* Header Navigation Arrows */}
            {totalHeaderPages > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                    isHeaderHovered ? "opacity-100" : "opacity-0"
                  } hover:opacity-100`}
                  onClick={() => navigateHeader("prev")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                    isHeaderHovered ? "opacity-100" : "opacity-0"
                  } hover:opacity-100`}
                  onClick={() => navigateHeader("next")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          {/* Header carousel indicators */}
          {totalHeaderPages > 1 && (
            <div className="flex justify-center gap-2">
              {Array.from({ length: totalHeaderPages }, (_, index) => (
                <button
                  key={index}
                  onClick={() => setHeaderCarouselIndex(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === headerCarouselIndex ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Content Section with Responsive Layout */}
      {(primaryComponents.length > 0 || secondaryComponents.length > 0) && (
        <div
          className="grid gap-6 grid-cols-1 lg:grid-cols-[3fr_2fr] pb-2 items-stretch"
          style={{ gridAutoRows: "1fr" }}
        >
          {/* Primary Section */}
          {primaryComponents.length > 0 && (
            <div className="flex flex-col space-y-4">
              <div
                className="relative group min-h-[500px] max-h-[500px]"
                onMouseEnter={() => {
                  setIsPrimaryHovered(true);
                }}
                onMouseLeave={() => {
                  setIsPrimaryHovered(false);
                }}
              >
                <div className="transition-all duration-300 ease-in-out h-full">
                  <div className="h-full">
                    {primaryComponents.length > 0 &&
                      primaryComponents[
                        primaryCarouselIndex % primaryComponents.length
                      ]}
                  </div>
                </div>

                {/* Primary Navigation Arrows */}
                {primaryComponents.length > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                        isPrimaryHovered ? "opacity-100" : "opacity-0"
                      } hover:opacity-100`}
                      onClick={() => navigatePrimary("prev")}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                        isPrimaryHovered ? "opacity-100" : "opacity-0"
                      } hover:opacity-100`}
                      onClick={() => navigatePrimary("next")}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>

              {/* Primary carousel indicators */}
              {primaryComponents.length > 1 && (
                <div className="flex justify-center gap-2">
                  {primaryComponents.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setPrimaryCarouselIndex(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === primaryCarouselIndex
                          ? "bg-primary"
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Secondary Section */}
          {secondaryComponents.length > 0 && (
            <div className="flex flex-col space-y-4">
              <div
                className="relative group min-h-[500px] max-h-[500px]"
                onMouseEnter={() => setIsSecondaryHovered(true)}
                onMouseLeave={() => setIsSecondaryHovered(false)}
              >
                <div className="transition-all duration-300 ease-in-out h-full">
                  <div className="h-full">
                    {secondaryComponents.length > 0 &&
                      secondaryComponents[
                        secondaryCarouselIndex % secondaryComponents.length
                      ]}
                  </div>
                </div>

                {/* Secondary Navigation Arrows */}
                {secondaryComponents.length > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                        isSecondaryHovered ? "opacity-100" : "opacity-0"
                      } hover:opacity-100`}
                      onClick={() => navigateSecondary("prev")}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                        isSecondaryHovered ? "opacity-100" : "opacity-0"
                      } hover:opacity-100`}
                      onClick={() => navigateSecondary("next")}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>

              {/* Secondary carousel indicators */}
              {secondaryComponents.length > 1 && (
                <div className="flex justify-center gap-2">
                  {secondaryComponents.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setSecondaryCarouselIndex(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index === secondaryCarouselIndex
                          ? "bg-primary"
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer Section with Dynamic Column Count */}
      {[leftFooterComponents, rightFooterComponents].filter((c) => c.length > 0)
        .length > 0 && (
        <div className="pb-8">
          <div className="grid gap-6 items-stretch grid-cols-1 lg:grid-cols-2">
            {/* Left Footer Section */}
            {leftFooterComponents.length > 0 && (
              <div className="flex flex-col space-y-4">
                <div
                  className="relative group min-h-[500px] max-h-[500px]"
                  onMouseEnter={() => setIsLeftFooterHovered(true)}
                  onMouseLeave={() => setIsLeftFooterHovered(false)}
                >
                  <div className="transition-all duration-300 ease-in-out h-full">
                    <div className="h-full">
                      {leftFooterComponents.length > 0 &&
                        leftFooterComponents[
                          leftFooterCarouselIndex % leftFooterComponents.length
                        ]}
                    </div>
                  </div>

                  {/* Left Footer Navigation Arrows */}
                  {leftFooterComponents.length > 1 && (
                    <>
                      <Button
                        variant="secondary"
                        size="icon"
                        className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                          isLeftFooterHovered ? "opacity-100" : "opacity-0"
                        } hover:opacity-100`}
                        onClick={() => navigateLeftFooter("prev")}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                          isLeftFooterHovered ? "opacity-100" : "opacity-0"
                        } hover:opacity-100`}
                        onClick={() => navigateLeftFooter("next")}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Left footer carousel indicators */}
                {leftFooterComponents.length > 1 && (
                  <div className="flex justify-center gap-2">
                    {leftFooterComponents.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setLeftFooterCarouselIndex(index)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          index === leftFooterCarouselIndex
                            ? "bg-primary"
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Right Footer Section */}
            {rightFooterComponents.length > 0 && (
              <div className="flex flex-col space-y-4">
                <div
                  className="relative group min-h-[500px] max-h-[500px]"
                  onMouseEnter={() => setIsRightFooterHovered(true)}
                  onMouseLeave={() => setIsRightFooterHovered(false)}
                >
                  <div className="transition-all duration-300 ease-in-out h-full">
                    <div className="h-full">
                      {rightFooterComponents.length > 0 &&
                        rightFooterComponents[
                          rightFooterCarouselIndex %
                            rightFooterComponents.length
                        ]}
                    </div>
                  </div>

                  {/* Right Footer Navigation Arrows */}
                  {rightFooterComponents.length > 1 && (
                    <>
                      <Button
                        variant="secondary"
                        size="icon"
                        className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                          isRightFooterHovered ? "opacity-100" : "opacity-0"
                        } hover:opacity-100`}
                        onClick={() => navigateRightFooter("prev")}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                          isRightFooterHovered ? "opacity-100" : "opacity-0"
                        } hover:opacity-100`}
                        onClick={() => navigateRightFooter("next")}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Right footer carousel indicators */}
                {rightFooterComponents.length > 1 && (
                  <div className="flex justify-center gap-2">
                    {rightFooterComponents.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setRightFooterCarouselIndex(index)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          index === rightFooterCarouselIndex
                            ? "bg-primary"
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <SimulationHistory
        showExport={false}
        showArchive={canArchive}
        singleProfile={false}
      />
    </div>
  );
}
