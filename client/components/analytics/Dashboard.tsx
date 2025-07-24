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
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllSimulationAttempts } from "@/utils/queries/simulation_attempts/get-all-simulation-attempts";
import { getAllSimulationChatGrades } from "@/utils/queries/simulation_chat_grades/get-all-simulation-chat-grades";
import { getAllSimulationChats } from "@/utils/queries/simulation_chats/get-all-simulation-chats";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import ScenarioPerformance from "../common/analytics/footer/ScenarioPerformance";
import ScenarioStats from "../common/analytics/footer/ScenarioStats";
import SimulationPerformance from "../common/analytics/footer/SimulationPerformance";
import SimulationStats from "../common/analytics/footer/SimulationStats";
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
import AttemptImprovement from "../common/analytics/primary/AttemptImprovement";
import Growth from "../common/analytics/primary/Growth";
import PersonaPerformance from "../common/analytics/primary/PersonaPerformance";
import CohortPerformance from "../common/analytics/secondary/CohortPerformance";
import RubricHeatmap from "../common/analytics/secondary/RubricHeatmap";
import SkillPerformance from "../common/analytics/secondary/SkillPerformance";

export default function Dashboard() {
  // Use analytics context for date range
  const { startDate, endDate } = useAnalytics();

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
  const [isPrimaryHovered, setIsPrimaryHovered] = useState(false);
  const [isSecondaryHovered, setIsSecondaryHovered] = useState(false);
  const [isLeftFooterHovered, setIsLeftFooterHovered] = useState(false);
  const [isRightFooterHovered, setIsRightFooterHovered] = useState(false);

  // Data queries
  const { effectiveProfile: _effectiveProfile } = useProfile();

  // Background data loading (for component functionality)
  const { isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { isLoading: isLoadingAttempts } = useQuery({
    queryKey: ["attempts"],
    queryFn: () => getAllSimulationAttempts(),
  });

  const { isLoading: isLoadingChats } = useQuery({
    queryKey: ["chats"],
    queryFn: () => getAllSimulationChats(),
  });

  const { isLoading: isLoadingGrades } = useQuery({
    queryKey: ["grades"],
    queryFn: () => getAllSimulationChatGrades(),
  });

  const headerComponents = [
    <AverageScore
      key="average-score"
      dateStart={startDate}
      dateEnd={endDate}
      thresholds={thresholds}
    />,
    <CompletionPercentage
      key="completion-percentage"
      dateStart={startDate}
      dateEnd={endDate}
      thresholds={thresholds}
    />,
    <FirstAttemptPassRate
      key="first-attempt-pass-rate"
      dateStart={startDate}
      dateEnd={endDate}
      thresholds={thresholds}
    />,
    <HighestScore
      key="highest-score"
      dateStart={startDate}
      dateEnd={endDate}
      thresholds={thresholds}
    />,
    <MessagesPerSession
      key="messages-per-session"
      dateStart={startDate}
      dateEnd={endDate}
      thresholds={thresholds}
    />,
    <PersonaResponseTimes
      key="persona-response-times"
      dateStart={startDate}
      dateEnd={endDate}
      thresholds={thresholds}
    />,
    <SessionEfficiency
      key="session-efficiency"
      dateStart={startDate}
      dateEnd={endDate}
      thresholds={thresholds}
    />,
    <StagnationRate
      key="stagnation-rate"
      dateStart={startDate}
      dateEnd={endDate}
      thresholds={thresholds}
    />,
    <TimeSpent
      key="time-spent"
      dateStart={startDate}
      dateEnd={endDate}
      thresholds={thresholds}
    />,
    <TotalAttempts
      key="total-attempts"
      dateStart={startDate}
      dateEnd={endDate}
      thresholds={thresholds}
    />,
  ];

  const primaryComponents = [
    <AttemptImprovement
      key="attempt-improvement"
      dateStart={startDate}
      dateEnd={endDate}
    />,
    <Growth key="growth" dateStart={startDate} dateEnd={endDate} />,
    <PersonaPerformance
      key="persona-performance"
      dateStart={startDate}
      dateEnd={endDate}
      thresholds={thresholds}
    />,
  ];

  const secondaryComponents = [
    <CohortPerformance
      key="cohort-performance"
      dateStart={startDate}
      dateEnd={endDate}
      thresholds={thresholds}
    />,
    <RubricHeatmap
      key="rubric-heatmap"
      dateStart={startDate}
      dateEnd={endDate}
      _thresholds={thresholds}
    />,
    <SkillPerformance
      key="skill-performance"
      dateStart={startDate}
      dateEnd={endDate}
      _thresholds={thresholds}
    />,
  ];

  const leftFooterComponents = [
    <ScenarioPerformance
      key="scenario-performance"
      dateStart={startDate}
      dateEnd={endDate}
      thresholds={thresholds}
    />,
    <ScenarioStats
      key="scenario-stats"
      dateStart={startDate}
      dateEnd={endDate}
      _thresholds={thresholds}
    />,
  ];

  const rightFooterComponents = [
    <SimulationPerformance
      key="simulation-performance"
      dateStart={startDate}
      dateEnd={endDate}
      thresholds={thresholds}
    />,
    <SimulationStats
      key="simulation-stats"
      dateStart={startDate}
      dateEnd={endDate}
      _thresholds={thresholds}
    />,
  ];

  // Navigation functions
  const navigatePrimary = (direction: "prev" | "next") => {
    const length = primaryComponents.length || 1;
    if (direction === "prev") {
      setPrimaryCarouselIndex((prev: number) => (prev - 1 + length) % length);
    } else {
      setPrimaryCarouselIndex((prev: number) => (prev + 1) % length);
    }
  };

  const navigateSecondary = (direction: "prev" | "next") => {
    const length = secondaryComponents.length || 1;
    if (direction === "prev") {
      setSecondaryCarouselIndex((prev: number) => (prev - 1 + length) % length);
    } else {
      setSecondaryCarouselIndex((prev: number) => (prev + 1) % length);
    }
  };

  const navigateLeftFooter = (direction: "prev" | "next") => {
    const filteredComponents =
      leftFooterComponents?.filter((_, index: number) => index % 2 === 0) || [];
    const length = filteredComponents.length || 1;
    if (direction === "prev") {
      setLeftFooterCarouselIndex(
        (prev: number) => (prev - 1 + length) % length
      );
    } else {
      setLeftFooterCarouselIndex((prev: number) => (prev + 1) % length);
    }
  };

  const navigateRightFooter = (direction: "prev" | "next") => {
    const filteredComponents =
      rightFooterComponents?.filter((_, index: number) => index % 2 === 1) ||
      [];
    const length = filteredComponents.length || 1;
    if (direction === "prev") {
      setRightFooterCarouselIndex(
        (prev: number) => (prev - 1 + length) % length
      );
    } else {
      setRightFooterCarouselIndex((prev: number) => (prev + 1) % length);
    }
  };

  // Loading state
  if (
    isLoadingProfiles ||
    isLoadingAttempts ||
    isLoadingChats ||
    isLoadingGrades
  ) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Metrics with Dynamic Pagination */}
      {headerComponents.length > 0 && (
        <div className="space-y-4">
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(5, 1fr)`,
            }}
          >
            {headerComponents.map((component, _index) => (
              <div
                key={`${headerCarouselIndex}`}
                className="transition-all duration-500 ease-in-out"
              >
                {component}
              </div>
            ))}
          </div>

          {/* Header carousel indicators */}
          {headerComponents.length > 1 && (
            <div className="flex justify-center gap-2">
              {headerComponents.map((_, index) => (
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
                className="relative flex-1 group"
                onMouseEnter={() => {
                  setIsPrimaryHovered(true);
                }}
                onMouseLeave={() => {
                  setIsPrimaryHovered(false);
                }}
              >
                {primaryComponents.length > 0 &&
                  primaryComponents[
                    primaryCarouselIndex % primaryComponents.length
                  ]}

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
                        index ===
                        primaryCarouselIndex % primaryComponents.length
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
                className="relative flex-1 group"
                onMouseEnter={() => setIsSecondaryHovered(true)}
                onMouseLeave={() => setIsSecondaryHovered(false)}
              >
                {secondaryComponents.length > 0 &&
                  secondaryComponents[
                    secondaryCarouselIndex % secondaryComponents.length
                  ]}

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
                        index ===
                        secondaryCarouselIndex % secondaryComponents.length
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
          {(() => {
            const footerCols =
              [leftFooterComponents, rightFooterComponents].filter(
                (c) => c.length > 0
              ).length || 1;

            return (
              <div
                className="grid gap-6 items-stretch"
                style={{
                  gridTemplateColumns: `repeat(${footerCols}, 1fr)`,
                  gridAutoRows: "1fr",
                }}
              >
                {/* Left Footer Section */}
                {leftFooterComponents.length > 0 && (
                  <div className="space-y-4">
                    <div
                      className="relative group"
                      onMouseEnter={() => setIsLeftFooterHovered(true)}
                      onMouseLeave={() => setIsLeftFooterHovered(false)}
                    >
                      {leftFooterComponents.length > 0 &&
                        leftFooterComponents[
                          leftFooterCarouselIndex % leftFooterComponents.length
                        ]}

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
                              index ===
                              leftFooterCarouselIndex %
                                leftFooterComponents.length
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
                  <div className="space-y-4">
                    <div
                      className="relative group"
                      onMouseEnter={() => setIsRightFooterHovered(true)}
                      onMouseLeave={() => setIsRightFooterHovered(false)}
                    >
                      {rightFooterComponents.length > 0 &&
                        rightFooterComponents[
                          rightFooterCarouselIndex %
                            rightFooterComponents.length
                        ]}

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
                              index ===
                              rightFooterCarouselIndex %
                                rightFooterComponents.length
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
            );
          })()}
        </div>
      )}
    </div>
  );
}
