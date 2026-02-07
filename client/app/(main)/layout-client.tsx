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
import { FullPageGenerateButton } from "@/components/common/drafts/FullPageGenerateButton";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { AccessControl } from "@/components/common/layout/AccessControl";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { NavigationBreadcrumbs } from "@/components/common/layout/NavigationBreadcrumbs";
import { UnifiedSidebar } from "@/components/common/layout/UnifiedSidebar";
import { ThemeHydrator } from "@/components/theme/ThemeHydrator";
import {
  BreadcrumbProvider,
  useBreadcrumbContext,
} from "@/contexts/breadcrumb-context";
import {
  FilterOptionsProvider,
  useFilterOptions,
} from "@/contexts/filter-options-context";
import { GenerationProvider } from "@/contexts/generation-context";
import { ProfileProviderClient, useProfile } from "@/contexts/profile-context";
import { SaveProvider } from "@/contexts/save-context";
import {
  generateBreadcrumbs,
  getActiveSectionFromPath,
} from "@/utils/breadcrumb-utils";
import { createSectionChangeHandler } from "@/utils/navigation-utils";
import { normalizeUrlPathToArtifactType } from "@/utils/resource-type-utils";
import type {
  AttemptFullOut,
  CreateFeedbackIn,
  CreateFeedbackOut,
  LayoutContextResponse,
  RefreshPageFn,
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
  refreshPageAction,
  searchSimulatableProfilesAction,
}: {
  children: React.ReactNode;
  attemptData: AttemptFullOut | null;
  switchEffectiveProfileAction: (
    input: SwitchEffectiveProfileParams
  ) => Promise<SwitchEffectiveProfileResult>;
  createFeedbackAction: (input: CreateFeedbackIn) => Promise<CreateFeedbackOut>;
  refreshPageAction: RefreshPageFn;
  searchSimulatableProfilesAction: (
    input: SearchSimulatableProfilesIn
  ) => Promise<SearchSimulatableProfilesOut>;
}) {
  const pathname = usePathname() || "/";

  const router = useRouter();
  const { profile } = useProfile();
  const { getEntityName } = useBreadcrumbContext();
  const { clearOptions } = useFilterOptions();

  // Clear section-specific filter options when navigating away from analytics-related pages
  useEffect(() => {
    const analyticsPages = ["/analytics", "/home", "/practice", "/leaderboard", "/benchmark"];
    const isAnalyticsPage = analyticsPages.some((p) => pathname.startsWith(p));
    if (!isAnalyticsPage) {
      clearOptions();
    }
  }, [pathname, clearOptions]);

  // Check if we're on the staff management pages (but not on /new page)
  const isStaffManagementPage = pathname === "/management/staff";

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

  const isPricingGroupPage = useMemo(() => {
    return pathname.startsWith("/analytics/pricing/g");
  }, [pathname]);

  const isHealthPage = useMemo(() => {
    return pathname === "/health";
  }, [pathname]);

  const isBenchmarkPage = useMemo(() => {
    return pathname === "/benchmark";
  }, [pathname]);

  const canShowAnalyticsFilters = useMemo(() => {
    // Show filters on leaderboard page for all authorized users
    if (pathname === "/leaderboard") {
      const allowedRoles = ["member", "instructional", "admin", "superadmin"];
      return (
        profile?.role && allowedRoles.includes(profile.role)
      );
    }
    // Show filters on health page for authorized users
    if (isHealthPage) {
      const allowedRoles = ["instructional", "admin", "superadmin"];
      return profile?.role && allowedRoles.includes(profile.role);
    }
    const allowedRoles = ["instructional", "admin", "superadmin"];
    return (
      profile?.role &&
      allowedRoles.includes(profile.role) &&
      (isAnalyticsPage || isHomePage || isPracticePage || isBenchmarkPage) &&
      !pathname.includes("/edit") &&
      !isPricingGroupPage
    );
  }, [
    profile?.role,
    isAnalyticsPage,
    pathname,
    isHomePage,
    isPracticePage,
    isBenchmarkPage,
    isPricingGroupPage,
    isHealthPage,
  ]);

  const handleSectionChange = createSectionChangeHandler(router, pathname);

  // Determine action button based on current path
  const getActionButton = () => {
    // Don't show buttons on /new pages
    if (pathname.includes("/new")) {
      return null;
    }

    if (pathname === "/training/cohorts") {
      return (
        <Button onClick={() => router.push("/training/cohorts/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Cohort
        </Button>
      );
    }

    if (pathname === "/training/personas") {
      return (
        <Button onClick={() => router.push("/training/personas/new")} size="sm">
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

    if (pathname === "/intelligence/rubrics") {
      return (
        <Button onClick={() => router.push("/intelligence/rubrics/new")} size="sm">
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

    if (pathname === "/training/scenarios") {
      return (
        <Button onClick={() => router.push("/training/scenarios/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Scenario
        </Button>
      );
    }

    if (pathname === "/training/simulations") {
      return (
        <Button
          onClick={() => router.push("/training/simulations/new")}
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

    if (pathname === "/intelligence/models") {
      return (
        <Button onClick={() => router.push("/intelligence/models/new")} size="sm">
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

    if (pathname === "/intelligence/agents") {
      return (
        <Button onClick={() => router.push("/intelligence/agents/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Agent
        </Button>
      );
    }

    if (pathname === "/intelligence/evals") {
      return (
        <Button onClick={() => router.push("/intelligence/evals/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Eval
        </Button>
      );
    }

    if (pathname === "/system/evals") {
      return (
        <Button onClick={() => router.push("/system/evals/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Eval
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

    if (pathname === "/system/keys") {
      return (
        <Button onClick={() => router.push("/system/keys/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Key
        </Button>
      );
    }

    if (pathname === "/settings") {
      return (
        <Button onClick={() => router.push("/settings/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Setting
        </Button>
      );
    }

    if (pathname === "/intelligence/tools") {
      return (
        <Button onClick={() => router.push("/intelligence/tools/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Tool
        </Button>
      );
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
    if (!attemptData || !attemptId || !profile || !attemptData.attempt) {
      return false;
    }
    return attemptData.attempt.profile_id === profile.id;
  }, [attemptData, attemptId, profile]);

  // Determine if we're on a create/edit page and get resource type
  const isCreateOrEditPage = useMemo(() => {
    // Match patterns like:
    // /create/personas/new, /create/personas/p/[id]
    // /management/staff/new
    // /engine/rubrics/new
    // /system/departments/new
    return /^\/(training|management|intelligence|system)\/([^/]+)\/(new|[pscrdafm]\/[^/]+)/.test(
      pathname
    );
  }, [pathname]);

  const urlPathSegment = useMemo(() => {
    if (!isCreateOrEditPage) return null;
    const match = pathname.match(
      /^\/(training|management|intelligence|system)\/([^/]+)/
    );
    return match ? match[2] : null; // Use second capture group (URL path segment)
  }, [pathname, isCreateOrEditPage]);

  // Normalize URL path segment from plural form to singular artifact enum value
  const artifactType = useMemo(() => {
    return urlPathSegment
      ? normalizeUrlPathToArtifactType(urlPathSegment)
      : null;
  }, [urlPathSegment]);

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
                benchmarkPage={isBenchmarkPage}
                healthPage={isHealthPage}
                refreshPage={refreshPageAction}
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

            {/* Generate Button - self-gates via GenerationCapability context (works on both create/edit and list pages) */}
            <FullPageGenerateButton />

            {/* SaveToolbar - Show on create/edit pages */}
            {isCreateOrEditPage && artifactType && (
              <SaveToolbar artifactType={artifactType} />
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
  initialAutosave,
  switchEffectiveProfileAction,
  createFeedbackAction,
  refreshPageAction,
  searchSimulatableProfilesAction,
}: {
  children: React.ReactNode;
  initial: LayoutContextResponse | null; // Can be null if user doesn't have access
  sessionSnapshot: SafeSessionSnapshot;
  attemptData: AttemptFullOut | null;
  activeSettings: SettingsActiveClient | null;
  /** Initial autosave preference from SSR cookie */
  initialAutosave?: boolean;
  switchEffectiveProfileAction: (
    input: SwitchEffectiveProfileParams
  ) => Promise<SwitchEffectiveProfileResult>;
  createFeedbackAction: (input: CreateFeedbackIn) => Promise<CreateFeedbackOut>;
  refreshPageAction: RefreshPageFn;
  searchSimulatableProfilesAction: (
    input: SearchSimulatableProfilesIn
  ) => Promise<SearchSimulatableProfilesOut>;
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
          <FilterOptionsProvider>
            <GenerationProvider>
              <SaveProvider initialAutosave={initialAutosave}>
                <MainLayoutContent
                  attemptData={attemptData}
                  switchEffectiveProfileAction={switchEffectiveProfileAction}
                  createFeedbackAction={createFeedbackAction}
                  refreshPageAction={refreshPageAction}
                  searchSimulatableProfilesAction={
                    searchSimulatableProfilesAction
                  }
                >
                  {children}
                </MainLayoutContent>
              </SaveProvider>
            </GenerationProvider>
          </FilterOptionsProvider>
        </BreadcrumbProvider>
      </ProfileProviderClient>
    </>
  );
}
