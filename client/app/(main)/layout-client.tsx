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
import React, { useMemo } from "react";

import AssistantChat from "@/components/assistant/AssistantChat";
import { SimulationControls } from "@/components/common/chat/SimulationControls";
import { AccessControl } from "@/components/common/layout/AccessControl";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { NavigationBreadcrumbs } from "@/components/common/layout/NavigationBreadcrumbs";
import TATour from "@/components/common/layout/TATour";
import { UnifiedSidebar } from "@/components/common/layout/UnifiedSidebar";
import { CreateStaffButton } from "@/components/common/staff/CreateStaffButton";
import { DocumentUploadButton } from "@/components/documents/DocumentUploadButton";
import { PracticeCustomizeButton } from "@/components/practice/PracticeCustomizeButton";
import { AnalyticsProvider } from "@/contexts/analytics-context";
import {
  BreadcrumbProvider,
  useBreadcrumbContext,
} from "@/contexts/breadcrumb-context";
import { ProfileProviderClient, useProfile } from "@/contexts/profile-context";
import { TourProvider } from "@/contexts/tour-context";
import {
  generateBreadcrumbs,
  getActiveSectionFromPath,
} from "@/utils/breadcrumb-utils";
import {
  createSectionChangeHandler,
  isMainScreen,
} from "@/utils/navigation-utils";
import type {
  AssistantChatFullIn,
  AssistantChatFullOut,
  AssistantChatListIn,
  AssistantChatListOut,
  AttemptFullOut,
  BulkCreateOrUpdateStaffIn,
  BulkCreateOrUpdateStaffOut,
  CreateFeedbackIn,
  CreateFeedbackOut,
  CreateStaffDataOut,
  LayoutContextResponse,
  MarkChatCompleteIn,
  MarkChatCompleteOut,
  MarkIntroCompleteIn,
  MarkIntroCompleteOut,
  ProcessCSVIn,
  ProcessCSVOut,
  RefreshAnalyticsIn,
  RefreshAnalyticsOut,
  SafeSessionSnapshot,
  SearchSimulatableProfilesIn,
  SearchSimulatableProfilesOut,
  SwitchEffectiveProfileParams,
  SwitchEffectiveProfileResult,
} from "./layout-server";

// Inner component that uses the role context
function MainLayoutContent({
  children,
  attemptData,
  markIntroCompleteAction,
  markChatCompleteAction,
  getAssistantChatListAction,
  getAssistantChatFullAction,
  switchEffectiveProfileAction,
  createFeedbackAction,
  refreshAnalyticsAction,
  searchSimulatableProfilesAction,
  processCSVAction,
  bulkCreateOrUpdateStaffAction,
  initialCreateStaffData,
}: {
  children: React.ReactNode;
  attemptData: AttemptFullOut | null;
  markIntroCompleteAction: (
    input: MarkIntroCompleteIn
  ) => Promise<MarkIntroCompleteOut>;
  markChatCompleteAction: (
    input: MarkChatCompleteIn
  ) => Promise<MarkChatCompleteOut>;
  getAssistantChatListAction: (
    input: AssistantChatListIn
  ) => Promise<AssistantChatListOut>;
  getAssistantChatFullAction: (
    input: AssistantChatFullIn
  ) => Promise<AssistantChatFullOut>;
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

  // Check if we're on the staff page
  const isStaffPage = pathname === "/management/staff";

  // Extract mappings from initialCreateStaffData for CreateStaffButton
  const departmentMapping = React.useMemo(() => {
    if (!initialCreateStaffData?.department_mapping) return {};
    const mapping: Record<
      string,
      { name: string; description?: string | null }
    > = {};
    Object.entries(initialCreateStaffData.department_mapping).forEach(
      ([id, dept]) => {
        if (dept && typeof dept === "object" && "name" in dept) {
          mapping[id] = {
            name: String(dept.name),
            description: dept.description ? String(dept.description) : null,
          };
        }
      }
    );
    return mapping;
  }, [initialCreateStaffData?.department_mapping]);

  const cohortMapping = React.useMemo(() => {
    if (!initialCreateStaffData?.cohort_mapping) return {};
    const mapping: Record<
      string,
      { name: string; description?: string | null }
    > = {};
    Object.entries(initialCreateStaffData.cohort_mapping).forEach(
      ([id, cohort]) => {
        if (cohort && typeof cohort === "object" && "name" in cohort) {
          mapping[id] = {
            name: String(cohort.name),
            description: cohort.description ? String(cohort.description) : null,
          };
        }
      }
    );
    return mapping;
  }, [initialCreateStaffData?.cohort_mapping]);

  const validDepartmentIds = React.useMemo(
    () => Object.keys(departmentMapping),
    [departmentMapping]
  );

  const validCohortIds = React.useMemo(
    () => Object.keys(cohortMapping),
    [cohortMapping]
  );

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

  const isChatPage = useMemo(() => {
    return pathname.startsWith("/practice/a") || pathname.startsWith("/home/a");
  }, [pathname]);

  // Check if we're on a main screen that should show chat components
  const shouldShowChatComponents = useMemo(() => {
    return isMainScreen(pathname) || isReportPage;
  }, [pathname, isReportPage]);

  // Check if user has permission to see chat components (instructional, admin, superadmin only)
  const canShowChatComponents = useMemo(() => {
    const allowedRoles = ["instructional", "admin", "superadmin"];
    return (
      effectiveProfile?.role &&
      allowedRoles.includes(effectiveProfile.role) &&
      !isChatPage
    );
  }, [effectiveProfile?.role, isChatPage]);

  // Check if we're on an analytics page and should show filters
  const isAnalyticsPage = useMemo(() => {
    return pathname.startsWith("/analytics");
  }, [pathname]);

  const isHomePage = useMemo(() => {
    return pathname === "/home";
  }, [pathname]);

  const canShowAnalyticsFilters = useMemo(() => {
    const allowedRoles = ["instructional", "admin", "superadmin"];
    return (
      effectiveProfile?.role &&
      allowedRoles.includes(effectiveProfile.role) &&
      (isAnalyticsPage || isHomePage) &&
      !pathname.includes("/edit")
    );
  }, [effectiveProfile?.role, isAnalyticsPage, pathname, isHomePage]);

  const handleSectionChange = createSectionChangeHandler(router, pathname);

  // Determine action button based on current path
  const getActionButton = () => {
    if (pathname === "/cohorts") {
      return (
        <Button onClick={() => router.push("/cohorts/new")} size="sm">
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

    if (pathname === "/create/documents") {
      return <DocumentUploadButton />;
    }

    if (pathname === "/management/rubrics") {
      return (
        <Button
          onClick={() => router.push("/management/rubrics/new")}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Rubric
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

    if (pathname === "/management/staff") {
      // CreateStaffButton is now handled directly in Staff.tsx component
      return null;
    }

    if (pathname === "/system/providers") {
      return (
        <Button onClick={() => router.push("/system/providers/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Provider
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

    if (pathname === "/management/agents") {
      return (
        <Button onClick={() => router.push("/management/agents/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Agent
        </Button>
      );
    }

    if (pathname === "/system/departments") {
      return (
        <Button
          onClick={() => router.push("/system/departments/new")}
          size="sm"
        >
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
      {shouldShowChatComponents && canShowChatComponents && (
        <AssistantChat
          getAssistantChatList={getAssistantChatListAction}
          getAssistantChatFull={getAssistantChatFullAction}
        />
      )}
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

            {/* Create Staff Button - Show in top right for staff page */}
            {isStaffPage &&
              initialCreateStaffData &&
              bulkCreateOrUpdateStaffAction && (
                <div className="pr-4">
                  <CreateStaffButton
                    onCreate={() => router.refresh()}
                    {...(processCSVAction !== undefined && {
                      processCSVAction,
                    })}
                    {...(bulkCreateOrUpdateStaffAction !== undefined && {
                      bulkCreateOrUpdateStaffAction,
                    })}
                    initialCreateStaffData={initialCreateStaffData}
                    validDepartmentIds={validDepartmentIds}
                    validCohortIds={validCohortIds}
                  />
                </div>
              )}

            {actionButton && <div className="pr-4">{actionButton}</div>}
          </header>

          <div
            className={`flex flex-1 flex-col gap-4 p-4 pt-0 ${
              shouldShowChatComponents && canShowChatComponents ? "pb-18" : ""
            }`}
          >
            <AccessControl pathname={pathname}>{children}</AccessControl>
          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* Tour Component - Available globally for TA users; hide when acting on behalf of another */}
      {effectiveProfile?.role === "ta" &&
        activeProfile?.id === effectiveProfile?.id && (
          <TATour
            markIntroCompleteAction={markIntroCompleteAction}
            markChatCompleteAction={markChatCompleteAction}
          />
        )}
    </>
  );
}

export function MainLayoutClient({
  children,
  initial,
  sessionSnapshot,
  attemptData,
  markIntroCompleteAction,
  markChatCompleteAction,
  getAssistantChatListAction,
  getAssistantChatFullAction,
  switchEffectiveProfileAction,
  createFeedbackAction,
  refreshAnalyticsAction,
  searchSimulatableProfilesAction,
  processCSVAction,
  bulkCreateOrUpdateStaffAction,
  initialCreateStaffData,
}: {
  children: React.ReactNode;
  initial: LayoutContextResponse;
  sessionSnapshot: SafeSessionSnapshot;
  attemptData: AttemptFullOut | null;
  markIntroCompleteAction: (
    input: MarkIntroCompleteIn
  ) => Promise<MarkIntroCompleteOut>;
  markChatCompleteAction: (
    input: MarkChatCompleteIn
  ) => Promise<MarkChatCompleteOut>;
  getAssistantChatListAction: (
    input: AssistantChatListIn
  ) => Promise<AssistantChatListOut>;
  getAssistantChatFullAction: (
    input: AssistantChatFullIn
  ) => Promise<AssistantChatFullOut>;
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
  return (
    <ProfileProviderClient initial={initial} sessionSnapshot={sessionSnapshot}>
      <TourProvider>
        <BreadcrumbProvider>
          <AnalyticsProvider>
            <MainLayoutContent
              attemptData={attemptData}
              markIntroCompleteAction={markIntroCompleteAction}
              markChatCompleteAction={markChatCompleteAction}
              getAssistantChatListAction={getAssistantChatListAction}
              getAssistantChatFullAction={getAssistantChatFullAction}
              switchEffectiveProfileAction={switchEffectiveProfileAction}
              createFeedbackAction={createFeedbackAction}
              refreshAnalyticsAction={refreshAnalyticsAction}
              searchSimulatableProfilesAction={searchSimulatableProfilesAction}
              {...(processCSVAction !== undefined && {
                processCSVAction,
              })}
              {...(bulkCreateOrUpdateStaffAction !== undefined && {
                bulkCreateOrUpdateStaffAction,
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
      </TourProvider>
    </ProfileProviderClient>
  );
}
