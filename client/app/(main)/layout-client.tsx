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

import { SimulationControls } from "@/components/artifacts/attempt/chat/SimulationControls";
import { FullPageGenerateButton } from "@/components/common/drafts/FullPageGenerateButton";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { NavigationBreadcrumbs } from "@/components/common/layout/NavigationBreadcrumbs";
import { UnifiedSidebar } from "@/components/common/layout/UnifiedSidebar";
import { ThemeHydrator } from "@/components/theme/ThemeHydrator";
import { GenerationProvider } from "@/contexts/generation-context";
import {
  DraftProviderClient,
  type DraftItem,
} from "@/contexts/draft-context";
import { ProfileProviderClient, useProfile } from "@/contexts/profile-context";
import { SocketProviderClient } from "@/contexts/socket-context";
import type {
  AnalyticsFiltersResponse,
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
  const { breadcrumbs: serverBreadcrumbs, pageMetadata } = useProfile();
  // Use server-driven breadcrumbs, falling back to empty array
  const breadcrumbs = useMemo(() => {
    return serverBreadcrumbs ?? [];
  }, [serverBreadcrumbs]);

  // Derive active section from server breadcrumbs
  const activeSection = useMemo(() => {
    if (breadcrumbs.length > 0 && breadcrumbs[0].section) {
      return breadcrumbs[0].section;
    }
    // Fallback: derive from pathname
    const segments = pathname.split("/").filter(Boolean);
    return segments[0] || "home";
  }, [breadcrumbs, pathname]);

  // Page metadata from server controls analytics filter visibility
  const canShowAnalyticsFilters = pageMetadata?.show_analytics_filters ?? false;

  // Check if we're on the staff management pages
  const isStaffManagementPage = pathname === "/management/staff";

  const handleSectionChange = (section: string) => {
    // Find URL for section from breadcrumbs or sidebar
    router.push(`/${section}`);
    router.refresh();
  };

  // Extract attemptId from pathname if we're on an attempt page
  const attemptMatch =
    pathname.match(/\/home\/([0-9a-f-]{36})/) ||
    pathname.match(/\/practice\/([0-9a-f-]{36})/);
  const attemptId = attemptMatch ? attemptMatch[1] : null;

  // Check if we should show SimulationControls
  const shouldShowSimulationControls = useMemo(() => {
    if (!attemptData || !attemptId || !attemptData.attempt) {
      return false;
    }
    return attemptData.is_own_attempt === true;
  }, [attemptData, attemptId]);

  // Use server-driven page metadata for create/edit detection
  const isCreateOrEditPage = pageMetadata?.show_save_toolbar ?? false;
  const artifactType = pageMetadata?.artifact_type ?? null;

  // Server-driven action button from pageMetadata
  const actionButton = useMemo(() => {
    if (!pageMetadata?.create_url || !pageMetadata?.create_label) return null;
    // Don't show on /new pages
    if (pathname.includes("/new")) return null;
    // Staff page has its own button
    if (isStaffManagementPage) return null;
    return (
      <Button onClick={() => router.push(pageMetadata.create_url!)} size="sm">
        <Plus className="h-4 w-4 mr-2" />
        {pageMetadata.create_label}
      </Button>
    );
  }, [pageMetadata, pathname, router, isStaffManagementPage]);

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
              <AnalyticsFilters refreshPage={refreshPageAction} />
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
            {children}
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
  drafts,
  analyticsFilters,
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
  drafts: DraftItem[];
  analyticsFilters: AnalyticsFiltersResponse | null;
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
      <SocketProviderClient
        profileId={initial?.id ?? null}
        sessionId={initial?.session_id ?? null}
      >
        <DraftProviderClient drafts={drafts} initialAutosave={initialAutosave}>
          <ProfileProviderClient
            initial={initial}
            sessionSnapshot={sessionSnapshot}
            analyticsFilters={analyticsFilters}
          >
            <GenerationProvider>
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
            </GenerationProvider>
          </ProfileProviderClient>
        </DraftProviderClient>
      </SocketProviderClient>
    </>
  );
}
