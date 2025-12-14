/**
 * Client component for main layout (uses hooks)
 */
"use client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useMemo } from "react";

import { SimulationControls } from "@/components/common/chat/SimulationControls";
import { AccessControl } from "@/components/common/layout/AccessControl";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { NavigationBreadcrumbs } from "@/components/common/layout/NavigationBreadcrumbs";
import { UnifiedSidebar } from "@/components/common/layout/UnifiedSidebar";
import { PracticeCustomizeButton } from "@/components/practice/PracticeCustomizeButton";
import { ThemeHydrator } from "@/components/theme/ThemeHydrator";
import { AnalyticsProvider } from "@/contexts/analytics-context";
import {
  BreadcrumbProvider,
  useBreadcrumbContext,
} from "@/contexts/breadcrumb-context";
import { ProfileProviderClient, useProfile } from "@/contexts/profile-context";
import {
  generateBreadcrumbs,
  getActiveSectionFromPath,
} from "@/utils/breadcrumb-utils";
import { createSectionChangeHandler } from "@/utils/navigation-utils";
import type {
  AttemptFullOut,
  BulkCreateOrUpdateStaffIn,
  BulkCreateOrUpdateStaffOut,
  CreateFeedbackIn,
  CreateFeedbackOut,
  CreateStaffDataOut,
  LayoutContextResponse,
  ProcessCSVIn,
  ProcessCSVOut,
  RefreshAnalyticsIn,
  RefreshAnalyticsOut,
  SafeSessionSnapshot,
  SearchSimulatableProfilesIn,
  SearchSimulatableProfilesOut,
  SettingsActiveClient,
  SwitchEffectiveProfileParams,
  SwitchEffectiveProfileResult,
} from "./layout-server";

// Inner component that uses the role context
function MainLayoutContent({
  children,
  attemptData,
  switchEffectiveProfileAction,
  createFeedbackAction,
  refreshAnalyticsAction,
  searchSimulatableProfilesAction,
}: {
  children: React.ReactNode;
  attemptData: AttemptFullOut | null;
  switchEffectiveProfileAction: (
    input: SwitchEffectiveProfileParams
  ) => Promise<SwitchEffectiveProfileResult>;
  createFeedbackAction: (input: CreateFeedbackIn) => Promise<CreateFeedbackOut>;
  refreshAnalyticsAction: (
    input: RefreshAnalyticsIn
  ) => Promise<RefreshAnalyticsOut>;
  searchSimulatableProfilesAction: (
    input: SearchSimulatableProfilesIn
  ) => Promise<SearchSimulatableProfilesOut>;
  processCSVAction?: (input: ProcessCSVIn) => Promise<ProcessCSVOut>;
  bulkCreateOrUpdateStaffAction?: (
    input: BulkCreateOrUpdateStaffIn
  ) => Promise<BulkCreateOrUpdateStaffOut>;
  initialCreateStaffData?: CreateStaffDataOut | null;
}) {
  const pathname = usePathname() || "/";

  const router = useRouter();
  const { effectiveProfile, activeProfile } = useProfile();
  const { getEntityName } = useBreadcrumbContext();

  // Check if we're on the staff management pages
  const isStaffManagementPage = pathname?.startsWith("/management/staff");

  // Generate breadcrumbs client-side and enrich with entity names from context
  const breadcrumbs = useMemo(() => {
    const baseBreadcrumbs = generateBreadcrumbs(pathname);

    // Enrich breadcrumbs with entity names from context
    return baseBreadcrumbs.map((crumb) => {
      // If title is truncated (e.g., "53385232..."), check context for entity name
      if (crumb.title.includes("...") && crumb.section) {
        const match = crumb.section.match(/-([\w-]+)$/);
        if (match && match[1]) {
          const entityId = match[1];
          const entityName = getEntityName(entityId);
          if (entityName) {
            return { ...crumb, title: entityName };
          }
        }
      }
      return crumb;
    });
  }, [pathname, getEntityName]);

  // Role context is available for child components
  const activeSection = getActiveSectionFromPath(pathname);

  const isReportPage = useMemo(() => {
    return pathname.startsWith("/analytics/reports/p");
  }, [pathname]);

  // Check if we're on an analytics page and should show filters
  const isAnalyticsPage = useMemo(() => {
    return pathname.startsWith("/analytics");
  }, [pathname]);

  const isHomePage = useMemo(() => {
    return pathname === "/home";
  }, [pathname]);

  const isPracticePage = useMemo(() => {
    return pathname === "/practice";
  }, [pathname]);

  const canShowAnalyticsFilters = useMemo(() => {
    // Show filters on leaderboard page for all authorized users
    if (pathname === "/leaderboard") {
      const allowedRoles = ["member", "instructional", "admin", "superadmin"];
      return (
        effectiveProfile?.role && allowedRoles.includes(effectiveProfile.role)
      );
    }
    const allowedRoles = ["instructional", "admin", "superadmin"];
    return (
      effectiveProfile?.role &&
      allowedRoles.includes(effectiveProfile.role) &&
      (isAnalyticsPage || isHomePage || isPracticePage) &&
      !pathname.includes("/edit")
    );
  }, [
    effectiveProfile?.role,
    isAnalyticsPage,
    pathname,
    isHomePage,
    isPracticePage,
  ]);

  const handleSectionChange = createSectionChangeHandler(router, pathname);

  // Determine action button based on current path
  const getActionButton = () => {
    if (pathname === "/create/cohorts") {
      return (
        <Button onClick={() => router.push("/create/cohorts/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Cohort
        </Button>
      );
    }

    if (pathname === "/create/personas") {
      return (
        <Button onClick={() => router.push("/create/personas/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Persona
        </Button>
      );
    }

    if (pathname === "/management/documents") {
      return (
        <Button
          onClick={() => router.push("/management/documents/new")}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Document
        </Button>
      );
    }

    if (pathname === "/engine/rubrics") {
      return (
        <Button onClick={() => router.push("/engine/rubrics/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Rubric
        </Button>
      );
    }

    if (pathname === "/system/auth") {
      return (
        <Button onClick={() => router.push("/system/auth/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Auth
        </Button>
      );
    }

    if (pathname === "/system/providers") {
      return (
        <Button onClick={() => router.push("/system/providers/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Provider
        </Button>
      );
    }

    if (pathname === "/create/scenarios") {
      return (
        <Button onClick={() => router.push("/create/scenarios/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Scenario
        </Button>
      );
    }

    if (pathname === "/create/simulations") {
      return (
        <Button
          onClick={() => router.push("/create/simulations/new")}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Simulation
        </Button>
      );
    }

    if (pathname === "/create/videos") {
      return (
        <Button onClick={() => router.push("/create/videos/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Video
        </Button>
      );
    }

    if (pathname === "/management/staff") {
      // CreateStaffButton is now handled directly in Staff.tsx component
      return null;
    }

    if (pathname === "/engine/models") {
      return (
        <Button onClick={() => router.push("/engine/models/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Model
        </Button>
      );
    }

    if (pathname === "/management/parameters") {
      return (
        <Button
          onClick={() => router.push("/management/parameters/new")}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Parameter
        </Button>
      );
    }

    if (pathname === "/management/fields") {
      return (
        <Button onClick={() => router.push("/management/fields/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Field
        </Button>
      );
    }

    if (pathname === "/engine/agents") {
      return (
        <Button onClick={() => router.push("/engine/agents/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Agent
        </Button>
      );
    }

    if (pathname === "/engine/evals") {
      return (
        <Button onClick={() => router.push("/engine/evals/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Eval
        </Button>
      );
    }

    if (pathname === "/departments") {
      return (
        <Button onClick={() => router.push("/departments/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Department
        </Button>
      );
    }

    // Practice page customize button
    if (pathname === "/practice") {
      return <PracticeCustomizeButton />;
    }

    // Chat components are now handled by AssistantChat
    return null;
  };

  const actionButton = getActionButton();

  // Extract attemptId from pathname if we're on an attempt page
  const attemptMatch =
    pathname.match(/\/home\/a\/([^/]+)/) ||
    pathname.match(/\/practice\/a\/([^/]+)/);
  const attemptId = attemptMatch ? attemptMatch[1] : null;

  // Check if we should show SimulationControls
  // Only show if we have attemptData, attemptId, and the attempt belongs to the active profile
  const shouldShowSimulationControls = useMemo(() => {
    if (!attemptData || !attemptId || !activeProfile) {
      return false;
    }
    return attemptData.attempt.profileId === activeProfile.id;
  }, [attemptData, attemptId, activeProfile]);

  return (
    <>
      <SidebarProvider>
        <UnifiedSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          switchEffectiveProfile={switchEffectiveProfileAction}
          createFeedback={createFeedbackAction}
          searchSimulatableProfiles={searchSimulatableProfilesAction}
        />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4 flex-1">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <NavigationBreadcrumbs
                breadcrumbs={breadcrumbs}
                onSectionChange={handleSectionChange}
              />
            </div>

            {/* Analytics Filters - Show in top right for analytics pages */}
            {canShowAnalyticsFilters && (
              <AnalyticsFilters
                homePage={isHomePage}
                reportPage={isReportPage}
                practicePage={isPracticePage}
                refreshAnalytics={refreshAnalyticsAction}
              />
            )}

            {/* SimulationControls - Show when on attempt page and attempt belongs to active profile */}
            {shouldShowSimulationControls && attemptId && attemptData && (
              <div className="pr-4">
                <SimulationControls
                  attemptId={attemptId}
                  attemptData={attemptData}
                />
              </div>
            )}

            {/* Add Staff Button - Show in top right for staff management pages */}
            {isStaffManagementPage && (
              <div className="pr-4">
                <Button
                  type="button"
                  onClick={() => router.push("/management/staff/new")}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Staff
                </Button>
              </div>
            )}

            {actionButton && <div className="pr-4">{actionButton}</div>}
          </header>

          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <AccessControl
              key={`access-control-${pathname}`}
              pathname={pathname}
            >
              {children}
            </AccessControl>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}

export function MainLayoutClient({
  children,
  initial,
  sessionSnapshot,
  attemptData,
  activeSettings,
  switchEffectiveProfileAction,
  createFeedbackAction,
  refreshAnalyticsAction,
  searchSimulatableProfilesAction,
  processCSVAction: _processCSVAction,
  bulkCreateOrUpdateStaffAction: _bulkCreateOrUpdateStaffAction,
  initialCreateStaffData,
}: {
  children: React.ReactNode;
  initial: LayoutContextResponse | null; // Can be null if user doesn't have access
  sessionSnapshot: SafeSessionSnapshot;
  attemptData: AttemptFullOut | null;
  activeSettings: SettingsActiveClient | null;
  switchEffectiveProfileAction: (
    input: SwitchEffectiveProfileParams
  ) => Promise<SwitchEffectiveProfileResult>;
  createFeedbackAction: (input: CreateFeedbackIn) => Promise<CreateFeedbackOut>;
  refreshAnalyticsAction: (
    input: RefreshAnalyticsIn
  ) => Promise<RefreshAnalyticsOut>;
  searchSimulatableProfilesAction: (
    input: SearchSimulatableProfilesIn
  ) => Promise<SearchSimulatableProfilesOut>;
  processCSVAction?: (input: ProcessCSVIn) => Promise<ProcessCSVOut>;
  bulkCreateOrUpdateStaffAction?: (
    input: BulkCreateOrUpdateStaffIn
  ) => Promise<BulkCreateOrUpdateStaffOut>;
  initialCreateStaffData?: CreateStaffDataOut | null;
}) {
  const pathname = usePathname();

  // Check if children contain UnifiedAccessDenied and force refresh if stale
  useEffect(() => {
    const checkAccessDenied = () => {
      const accessDeniedElement = document.querySelector(
        '[data-access-denied="true"]'
      );
      const wrapperElement = document.querySelector(
        `[data-route-pathname="${pathname}"]`
      );
      const wrapperPathname = wrapperElement?.getAttribute(
        "data-route-pathname"
      );

      // If we're on an allowed route but see access denied component, force refresh
      // This handles the case where navigation happens but React hasn't updated the DOM yet
      // Simple check: if we're on /practice (always allowed for guests) and see access denied, refresh
      // OR if wrapper says allowed but pathname doesn't match (stale wrapper)
      if (
        pathname === "/practice" &&
        accessDeniedElement &&
        (wrapperPathname !== pathname || !wrapperElement)
      ) {
        window.location.href = pathname || "/";
      }
    };

    checkAccessDenied();
    const interval = setInterval(checkAccessDenied, 100);
    return () => clearInterval(interval);
  }, [pathname]);

  return (
    <>
      <ThemeHydrator activeSettings={activeSettings} />
      <ProfileProviderClient
        initial={initial}
        sessionSnapshot={sessionSnapshot}
      >
        <BreadcrumbProvider>
          <AnalyticsProvider>
            <MainLayoutContent
              attemptData={attemptData}
              switchEffectiveProfileAction={switchEffectiveProfileAction}
              createFeedbackAction={createFeedbackAction}
              refreshAnalyticsAction={refreshAnalyticsAction}
              searchSimulatableProfilesAction={searchSimulatableProfilesAction}
              {...(_processCSVAction !== undefined && {
                processCSVAction: _processCSVAction,
              })}
              {...(_bulkCreateOrUpdateStaffAction !== undefined && {
                bulkCreateOrUpdateStaffAction: _bulkCreateOrUpdateStaffAction,
              })}
              {...(initialCreateStaffData !== undefined &&
                initialCreateStaffData !== null && {
                  initialCreateStaffData,
                })}
            >
              {children}
            </MainLayoutContent>
          </AnalyticsProvider>
        </BreadcrumbProvider>
      </ProfileProviderClient>
    </>
  );
}
