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
import { PanelRight, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useMemo } from "react";

import { SimulationControls } from "@/components/common/SimulationControls";
import { FullPageGenerateButton } from "@/components/common/drafts/FullPageGenerateButton";
import { InsightsButton } from "@/components/common/insights/InsightsButton";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { NavigationBreadcrumbs } from "@/components/common/layout/NavigationBreadcrumbs";
import { UnifiedSidebar } from "@/components/common/layout/UnifiedSidebar";
import { ThemeHydrator } from "@/components/theme/ThemeHydrator";
import {
  DraftProviderClient,
  type DraftItem,
} from "@/contexts/draft-context";
import {
  InsightsProviderClient,
  type InsightItem,
} from "@/contexts/insights-context";
import { ProfileProviderClient } from "@/contexts/profile-context";
import { SettingsProviderClient } from "@/contexts/settings-context";
import { SocketProviderClient } from "@/contexts/socket-context";
import { GenerationPanel } from "@/components/common/ai/GenerationPanel";
import { useGenerationPanel } from "@/hooks/use-generation-panel";
import type {
  AnalyticsFiltersResponse,
  AuthAttemptOut,
  AuthPageResponse,
  AuthProfileResponse,
  AuthSettingsResponse,
  CreateFeedbackIn,
  CreateFeedbackOut,
  GroupMessagesIn,
  GroupMessagesOut,
  RefreshPageFn,
  SafeSessionSnapshot,
  SearchSimulatableProfilesIn,
  SearchSimulatableProfilesOut,
  SwitchEffectiveProfileParams,
  SwitchEffectiveProfileResult,
} from "./layout-server";


// Inner component that uses the role context
function MainLayoutContent({
  children,
  pageData,
  attemptControls,
  initialPanelOpen,
  switchEffectiveProfileAction,
  createFeedbackAction,
  refreshPageAction,
  searchSimulatableProfilesAction,
  getGroupMessagesAction,
}: {
  children: React.ReactNode;
  pageData: AuthPageResponse | null;
  attemptControls: AuthAttemptOut | null;
  initialPanelOpen?: boolean;
  switchEffectiveProfileAction: (
    input: SwitchEffectiveProfileParams
  ) => Promise<SwitchEffectiveProfileResult>;
  createFeedbackAction: (input: CreateFeedbackIn) => Promise<CreateFeedbackOut>;
  refreshPageAction: RefreshPageFn;
  searchSimulatableProfilesAction: (
    input: SearchSimulatableProfilesIn
  ) => Promise<SearchSimulatableProfilesOut>;
  getGroupMessagesAction: (input: GroupMessagesIn) => Promise<GroupMessagesOut>;
}) {
  const pathname = usePathname() || "/";

  const router = useRouter();

  // Force layout server component to re-render when pathname changes.
  // Without this, pageData (breadcrumbs, action buttons, drafts) goes stale
  // on soft navigation because Next.js reuses cached layout RSC payloads.
  const prevPathnameRef = React.useRef(pathname);
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      router.refresh();
    }
  }, [pathname, router]);

  const serverBreadcrumbs = pageData?.breadcrumbs ?? null;
  const pageMetadata = pageData?.page_metadata ?? null;
  // Use server-driven breadcrumbs, falling back to empty array
  const breadcrumbs = useMemo(() => {
    return serverBreadcrumbs ?? [];
  }, [serverBreadcrumbs]);

  // Derive active section from server breadcrumbs
  // Use the last breadcrumb with a section (most specific match, e.g. "cohorts" not "training")
  const activeSection = useMemo(() => {
    if (breadcrumbs.length > 0) {
      for (let i = breadcrumbs.length - 1; i >= 0; i--) {
        if (breadcrumbs[i]?.section) {
          return breadcrumbs[i].section!;
        }
      }
    }
    // Fallback: derive from pathname
    const segments = pathname.split("/").filter(Boolean);
    return segments[0] || "home";
  }, [breadcrumbs, pathname]);

  // Page metadata from server controls analytics filter visibility
  const canShowAnalyticsFilters = pageMetadata?.show_analytics_filters ?? false;

  const handleSectionChange = (section: string) => {
    // Look up the correct URL from sidebar routes (handles nested routes like /training/cohorts)
    const sidebarRoutes = pageData?.sidebar_routes ?? [];
    let targetUrl = `/${section}`;
    for (const route of sidebarRoutes) {
      if (route.section === section) {
        targetUrl = route.url;
        break;
      }
      if (route.items) {
        const child = route.items.find((item) => item.section === section);
        if (child) {
          targetUrl = child.url;
          break;
        }
      }
    }
    router.push(targetUrl);
    router.refresh();
  };

  // Use server-driven page metadata for create/edit detection
  const showDrafts = pageMetadata?.show_drafts ?? false;
  const artifactType = pageMetadata?.artifact_type ?? null;

  // Server-driven valid types for AI generation panel
  const validArtifactTypes = pageMetadata?.valid_artifact_types ?? [];
  const validResourceTypes = pageMetadata?.valid_resource_types ?? [];
  const validEntryTypes = pageMetadata?.valid_entry_types ?? [];

  // Server-driven action button from pageMetadata
  const actionButton = useMemo(() => {
    if (!pageMetadata?.create_url || !pageMetadata?.create_label) return null;
    return (
      <Button onClick={() => router.push(pageMetadata.create_url!)} size="sm">
        <Plus className="h-4 w-4 mr-2" />
        {pageMetadata.create_label}
      </Button>
    );
  }, [pageMetadata, router]);

  // AI generation panel state — group_id injected by page context (null for now)
  const panel = useGenerationPanel({
    groupId: null,
    getGroupMessagesAction,
    initialPanelOpen,
  });

  return (
    <div className="flex min-h-svh w-full">
      <SidebarProvider>
        <UnifiedSidebar
          sidebarRoutes={pageData?.sidebar_routes ?? null}
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

            <InsightsButton artifactType={artifactType} />
            <FullPageGenerateButton artifactType={artifactType} />
            {attemptControls?.show_controls && (
              <div className="pr-4">
                <SimulationControls
                  attemptId={attemptControls.attempt_id!}
                  currentChatId={attemptControls.current_chat_id!}
                  simulationId={attemptControls.simulation_id!}
                  hasMessages={attemptControls.has_messages ?? false}
                />
              </div>
            )}
            {canShowAnalyticsFilters && (
              <AnalyticsFilters refreshPage={refreshPageAction} />
            )}
            {!attemptControls?.show_controls && (
              showDrafts && artifactType ? (
                <SaveToolbar artifactType={artifactType} />
              ) : (
                actionButton && <div className="pr-4">{actionButton}</div>
              )
            )}
            <div className="pr-4">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={panel.togglePanel}
              >
                <PanelRight className="h-4 w-4" />
                <span className="sr-only">Toggle right panel</span>
              </Button>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
      <GenerationPanel
        panel={panel}
        artifactType={artifactType}
        validArtifactTypes={validArtifactTypes}
        validResourceTypes={validResourceTypes}
        validEntryTypes={validEntryTypes}
      />
    </div>
  );
}

export function MainLayoutClient({
  children,
  profileData,
  settingsData,
  pageData,
  sessionSnapshot,
  attemptControls,
  drafts,
  insights,
  analyticsFilters,
  initialAutosave,
  initialPanelOpen,
  switchEffectiveProfileAction,
  createFeedbackAction,
  refreshPageAction,
  searchSimulatableProfilesAction,
  getGroupMessagesAction,
}: {
  children: React.ReactNode;
  profileData: AuthProfileResponse | null;
  settingsData: AuthSettingsResponse | null;
  pageData: AuthPageResponse | null;
  sessionSnapshot: SafeSessionSnapshot;
  attemptControls: AuthAttemptOut | null;
  drafts: DraftItem[];
  insights: InsightItem[];
  analyticsFilters: AnalyticsFiltersResponse | null;
  /** Initial autosave preference from SSR cookie */
  initialAutosave?: boolean;
  /** Initial AI panel open state from SSR cookie */
  initialPanelOpen?: boolean;
  switchEffectiveProfileAction: (
    input: SwitchEffectiveProfileParams
  ) => Promise<SwitchEffectiveProfileResult>;
  createFeedbackAction: (input: CreateFeedbackIn) => Promise<CreateFeedbackOut>;
  refreshPageAction: RefreshPageFn;
  searchSimulatableProfilesAction: (
    input: SearchSimulatableProfilesIn
  ) => Promise<SearchSimulatableProfilesOut>;
  getGroupMessagesAction: (input: GroupMessagesIn) => Promise<GroupMessagesOut>;
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
      <ThemeHydrator tokens={settingsData?.tokens ?? null} />
      <SocketProviderClient
        profileId={profileData?.id ?? null}
        sessionId={profileData?.session_id ?? null}
      >
        <DraftProviderClient drafts={drafts} initialAutosave={initialAutosave}>
          <InsightsProviderClient insights={insights}>
            <ProfileProviderClient
              initial={profileData}
              sessionSnapshot={sessionSnapshot}
              analyticsFilters={analyticsFilters}
            >
              <SettingsProviderClient settings={settingsData}>
                <MainLayoutContent
                  pageData={pageData}
                  attemptControls={attemptControls}
                  initialPanelOpen={initialPanelOpen}
                  switchEffectiveProfileAction={switchEffectiveProfileAction}
                  createFeedbackAction={createFeedbackAction}
                  refreshPageAction={refreshPageAction}
                  searchSimulatableProfilesAction={
                    searchSimulatableProfilesAction
                  }
                  getGroupMessagesAction={getGroupMessagesAction}
                >
                  {children}
                </MainLayoutContent>
              </SettingsProviderClient>
            </ProfileProviderClient>
          </InsightsProviderClient>
        </DraftProviderClient>
      </SocketProviderClient>
    </>
  );
}
