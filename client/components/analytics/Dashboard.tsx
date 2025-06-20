/**
 * Dashboard.tsx
 * Used to display the main dashboard for the analytics page.
 * Now fully dynamic using database components and dashboards.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import registry from "@/components/common/analytics/Registry";
import { useDashboard } from "@/contexts/dashboard-context";
import { logError } from "@/utils/logger";
import { getAllComponents } from "@/utils/queries/components/get-all-components";
import { getAllDashboards } from "@/utils/queries/dashboards/get-all-dashboards";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { getAllSimulationAttempts } from "@/utils/queries/simulation_attempts/get-all-simulation-attempts";
import { getAllSimulationChatGrades } from "@/utils/queries/simulation_chat_grades/get-all-simulation-chat-grades";
import { getAllSimulationChats } from "@/utils/queries/simulation_chats/get-all-simulation-chats";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import DashboardEdit from "../common/dashboard/DashboardEdit";

interface DashboardConfig {
  id: string;
  headerComponentIds: string[];
  primaryComponentIds: string[];
  secondaryComponentIds: string[];
  footerComponentIds: string[];
  autoScroll: boolean;
  showIndicators: boolean;
  headerComponents: number;
  mainSplit: number;
  footerSplit: number;
}

export default function Dashboard() {
  // Get edit mode state from context
  const { isEditMode } = useDashboard();

  // Session and user data
  const { data: session } = useSession();
  const userId = session?.user?.id;

  // Carousel states
  const [headerCarouselIndex, setHeaderCarouselIndex] = useState(0);
  const [primaryCarouselIndex, setPrimaryCarouselIndex] = useState(0);
  const [secondaryCarouselIndex, setSecondaryCarouselIndex] = useState(0);
  const [leftFooterCarouselIndex, setLeftFooterCarouselIndex] = useState(0);
  const [rightFooterCarouselIndex, setRightFooterCarouselIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Data queries
  const { data: userProfile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfilesByUser(parseInt(userId!)),
    select: (data) => data[0],
    enabled: !!userId,
  });

  const { data: components, isLoading: isLoadingComponents } = useQuery({
    queryKey: ["components"],
    queryFn: () => getAllComponents(),
  });

  const { data: dashboards, isLoading: isLoadingDashboards } = useQuery({
    queryKey: ["dashboards"],
    queryFn: () => getAllDashboards(),
  });

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

  // Memoized dashboard configuration
  const dashboardConfig: DashboardConfig | null = useMemo(() => {
    if (!dashboards || !userProfile) return null;

    // Try to find user's personal dashboard first
    let dashboard = dashboards.find((d) => d.profileId === userProfile.id);

    // Fallback to global dashboard
    if (!dashboard) {
      dashboard = dashboards.find((d) => d.profileId === null);
    }

    if (!dashboard) {
      logError("No dashboard found for user or global fallback", undefined, {
        userId: userProfile.id,
        availableDashboards: dashboards.length,
      });
      return null;
    }

    return {
      id: dashboard.id,
      headerComponentIds: dashboard.headerComponentIds || [],
      primaryComponentIds: dashboard.primaryComponentIds || [],
      secondaryComponentIds: dashboard.secondaryComponentIds || [],
      footerComponentIds: dashboard.footerComponentIds || [],
      autoScroll: dashboard.autoScroll || false,
      showIndicators: dashboard.showIndicators || false,
      headerComponents: dashboard.headerComponents || 4,
      mainSplit: dashboard.mainSplit || 0.75,
      footerSplit: dashboard.footerSplit || 0.5,
    };
  }, [dashboards, userProfile]);

  // Memoized components lookup
  const componentsLookup = useMemo(() => {
    if (!components) return new Map();

    return new Map(
      components.map((comp) => [
        comp.id,
        {
          id: comp.id,
          name: comp.name,
          fileName: comp.fileName,
          layout: (comp.layout as Record<string, unknown>) || {},
        },
      ])
    );
  }, [components]);

  // Render a single component by UUID
  const renderComponent = (componentId: string, key?: string) => {
    const component = componentsLookup.get(componentId);
    if (!component) {
      logError("Component not found in registry", undefined, {
        componentId,
        availableComponents: Array.from(componentsLookup.keys()),
      });
      return null;
    }

    const registryEntry = registry[componentId];
    if (!registryEntry) {
      logError("Component not found in registry", undefined, {
        componentId,
        registryKeys: Object.keys(registry),
      });
      return null;
    }

    const Component = registryEntry.component;
    const props = {
      ...registryEntry.props,
      ...component.layout,
    };

    return <Component key={key || componentId} {...props} />;
  };

  // Header pagination logic
  const headerPages = useMemo(() => {
    if (!dashboardConfig) return [];

    const { headerComponentIds, headerComponents } = dashboardConfig;
    const pages = [];
    const totalPages = Math.ceil(headerComponentIds.length / headerComponents);

    for (let i = 0; i < totalPages; i++) {
      const start = i * headerComponents;
      const end = start + headerComponents;
      const pageComponents = headerComponentIds.slice(start, end);
      pages.push(pageComponents);
    }

    return pages;
  }, [dashboardConfig]);

  // Auto-scroll effects
  useEffect(() => {
    if (!dashboardConfig?.autoScroll) return;

    // Header carousel auto-scroll (4s interval)
    const headerInterval = setInterval(() => {
      setHeaderCarouselIndex((prev) => (prev + 1) % headerPages.length);
    }, 4000);

    return () => clearInterval(headerInterval);
  }, [dashboardConfig?.autoScroll, headerPages.length]);

  useEffect(() => {
    if (!dashboardConfig?.autoScroll) return;

    // Primary carousel auto-scroll (5s interval, paused on hover)
    if (!isHovered) {
      const primaryInterval = setInterval(() => {
        setPrimaryCarouselIndex(
          (prev) =>
            (prev + 1) % (dashboardConfig.primaryComponentIds?.length || 1)
        );
      }, 5000);

      return () => clearInterval(primaryInterval);
    }
    return () => {};
  }, [
    dashboardConfig?.autoScroll,
    dashboardConfig?.primaryComponentIds?.length,
    isHovered,
  ]);

  useEffect(() => {
    if (!dashboardConfig?.autoScroll) return;

    // Secondary carousel auto-scroll (4s interval)
    const secondaryInterval = setInterval(() => {
      setSecondaryCarouselIndex(
        (prev) =>
          (prev + 1) % (dashboardConfig.secondaryComponentIds?.length || 1)
      );
    }, 4000);

    return () => clearInterval(secondaryInterval);
  }, [
    dashboardConfig?.autoScroll,
    dashboardConfig?.secondaryComponentIds?.length,
  ]);

  useEffect(() => {
    if (!dashboardConfig?.autoScroll) return;

    // Left footer carousel auto-scroll (6s interval)
    const leftFooterInterval = setInterval(() => {
      setLeftFooterCarouselIndex((prev) => {
        const leftFooterComponents = Math.ceil(
          (dashboardConfig.footerComponentIds?.length || 0) / 2
        );
        return (prev + 1) % leftFooterComponents;
      });
    }, 6000);

    return () => clearInterval(leftFooterInterval);
  }, [
    dashboardConfig?.autoScroll,
    dashboardConfig?.footerComponentIds?.length,
  ]);

  useEffect(() => {
    if (!dashboardConfig?.autoScroll) return;

    // Right footer carousel auto-scroll (7s interval)
    const rightFooterInterval = setInterval(() => {
      setRightFooterCarouselIndex((prev) => {
        const rightFooterComponents = Math.floor(
          (dashboardConfig.footerComponentIds?.length || 0) / 2
        );
        return (prev + 1) % rightFooterComponents;
      });
    }, 7000);

    return () => clearInterval(rightFooterInterval);
  }, [
    dashboardConfig?.autoScroll,
    dashboardConfig?.footerComponentIds?.length,
  ]);

  // Early return for edit mode
  if (isEditMode) {
    return <DashboardEdit />;
  }

  // Loading state
  if (
    isLoadingComponents ||
    isLoadingDashboards ||
    isLoadingProfiles ||
    isLoadingAttempts ||
    isLoadingChats ||
    isLoadingGrades ||
    !dashboardConfig
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

  const {
    headerComponentIds,
    primaryComponentIds,
    secondaryComponentIds,
    footerComponentIds,
    showIndicators,
    headerComponents,
    mainSplit,
    footerSplit,
  } = dashboardConfig;

  // Get current page components for header
  const currentHeaderPage = headerPages[headerCarouselIndex] || [];

  // Split footer components for left/right sections
  const leftFooterComponents = footerComponentIds.filter(
    (_, index) => index % 2 === 0
  );
  const rightFooterComponents = footerComponentIds.filter(
    (_, index) => index % 2 === 1
  );

  return (
    <div className="space-y-6">
      {/* Header Metrics with Dynamic Pagination */}
      {headerComponentIds.length > 0 && (
        <div className="space-y-4">
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${headerComponents}, 1fr)`,
            }}
          >
            {currentHeaderPage.map((componentId, index) => (
              <div
                key={`${componentId}-${headerCarouselIndex}-${index}`}
                className="transition-all duration-500 ease-in-out"
              >
                {renderComponent(componentId)}
              </div>
            ))}
            {/* Fill remaining slots with empty divs for consistent spacing */}
            {Array.from({
              length: Math.max(0, headerComponents - currentHeaderPage.length),
            }).map((_, index) => (
              <div key={`empty-${index}`} className="invisible" />
            ))}
          </div>

          {/* Header carousel indicators */}
          {showIndicators && headerPages.length > 1 && (
            <div className="flex justify-center gap-2">
              {headerPages.map((_, index) => (
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

      {/* Main Content Section with Dynamic Split */}
      {(primaryComponentIds.length > 0 || secondaryComponentIds.length > 0) && (
        <div
          className="grid gap-6"
          style={{
            gridTemplateColumns:
              window.innerWidth >= 1024
                ? `${mainSplit * 100}% ${(1 - mainSplit) * 100}%`
                : "1fr",
          }}
        >
          {/* Primary Section */}
          {primaryComponentIds.length > 0 && (
            <div className="space-y-4">
              <div
                className="relative"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                {primaryComponentIds.length > 0 &&
                  renderComponent(
                    primaryComponentIds[
                      primaryCarouselIndex % primaryComponentIds.length
                    ]!,
                    `primary-${primaryCarouselIndex}`
                  )}
              </div>

              {/* Primary carousel indicators */}
              {showIndicators && primaryComponentIds.length > 1 && (
                <div className="flex justify-center gap-2">
                  {primaryComponentIds.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setPrimaryCarouselIndex(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index ===
                        primaryCarouselIndex % primaryComponentIds.length
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
          {secondaryComponentIds.length > 0 && (
            <div className="space-y-4">
              {secondaryComponentIds.length > 0 &&
                renderComponent(
                  secondaryComponentIds[
                    secondaryCarouselIndex % secondaryComponentIds.length
                  ]!,
                  `secondary-${secondaryCarouselIndex}`
                )}

              {/* Secondary carousel indicators */}
              {showIndicators && secondaryComponentIds.length > 1 && (
                <div className="flex justify-center gap-2">
                  {secondaryComponentIds.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setSecondaryCarouselIndex(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index ===
                        secondaryCarouselIndex % secondaryComponentIds.length
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

      {/* Footer Section with Dynamic Split */}
      {footerComponentIds.length > 0 && (
        <div
          className="grid gap-6"
          style={{
            gridTemplateColumns:
              window.innerWidth >= 1024
                ? `${footerSplit * 100}% ${(1 - footerSplit) * 100}%`
                : "1fr",
          }}
        >
          {/* Left Footer Section */}
          {leftFooterComponents.length > 0 && (
            <div className="space-y-4">
              {leftFooterComponents.length > 0 &&
                renderComponent(
                  leftFooterComponents[
                    leftFooterCarouselIndex % leftFooterComponents.length
                  ]!,
                  `left-footer-${leftFooterCarouselIndex}`
                )}

              {/* Left footer carousel indicators */}
              {showIndicators && leftFooterComponents.length > 1 && (
                <div className="flex justify-center gap-2">
                  {leftFooterComponents.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setLeftFooterCarouselIndex(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index ===
                        leftFooterCarouselIndex % leftFooterComponents.length
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
              {rightFooterComponents.length > 0 &&
                renderComponent(
                  rightFooterComponents[
                    rightFooterCarouselIndex % rightFooterComponents.length
                  ]!,
                  `right-footer-${rightFooterCarouselIndex}`
                )}

              {/* Right footer carousel indicators */}
              {showIndicators && rightFooterComponents.length > 1 && (
                <div className="flex justify-center gap-2">
                  {rightFooterComponents.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setRightFooterCarouselIndex(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index ===
                        rightFooterCarouselIndex % rightFooterComponents.length
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
    </div>
  );
}
