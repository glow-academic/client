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

import ChatDialog from "@/components/assistant/ChatDialog";
import ChatFab from "@/components/assistant/ChatFab";
import ChatWidget from "@/components/assistant/ChatWidget";
import { SimulationControls } from "@/components/common/chat/SimulationControls";
import { AccessControl } from "@/components/common/layout/AccessControl";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { NavigationBreadcrumbs } from "@/components/common/layout/NavigationBreadcrumbs";
import TATour from "@/components/common/layout/TATour";
import { UnifiedSidebar } from "@/components/common/layout/UnifiedSidebar";
import { DocumentUploadButton } from "@/components/documents/DocumentUploadButton";
import { PracticeCustomizeButton } from "@/components/practice/PracticeCustomizeButton";
import { AnalyticsProvider } from "@/contexts/analytics-context";
import { AssistantProvider } from "@/contexts/assistant-context";
import {
  BreadcrumbProvider,
  useBreadcrumbContext,
} from "@/contexts/breadcrumb-context";
import { ProfileProviderClient, useProfile } from "@/contexts/profile-context";
import { TourProvider } from "@/contexts/tour-context";
import { WebSocketProvider } from "@/contexts/websocket-context";
import {
  generateBreadcrumbs,
  getActiveSectionFromPath,
} from "@/utils/breadcrumb-utils";
import {
  createSectionChangeHandler,
  isMainScreen,
} from "@/utils/navigation-utils";
import type { LayoutContextResponse } from "./layout-server";

// Inner component that uses the role context
function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { effectiveProfile, activeProfile } = useProfile();
  const { getEntityName } = useBreadcrumbContext();

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

    if (!shouldShowChatComponents && canShowChatComponents) {
      return (
        <>
          <ChatFab up={true} />
          <ChatWidget up={true} />
          <ChatDialog />
        </>
      );
    }

    return null;
  };

  const actionButton = getActionButton();

  return (
    <AssistantProvider>
      <SidebarProvider>
        <UnifiedSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
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
              />
            )}

            {/* Simulation Controls - Only shown when in an attempt */}
            <div className="pr-4">
              <SimulationControls />
            </div>

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

      {/* Chat Components - Only show on main screens defined in the sidebar for allowed roles */}
      {shouldShowChatComponents && canShowChatComponents && (
        <>
          <ChatFab up={false} />
          <ChatWidget up={false} />
          <ChatDialog />
        </>
      )}

      {/* Tour Component - Available globally for TA users; hide when acting on behalf of another */}
      {effectiveProfile?.role === "ta" &&
        activeProfile?.id === effectiveProfile?.id && <TATour />}
    </AssistantProvider>
  );
}

// Wrapper component for WebSocket that gets profileId from ProfileContext
function WebSocketProviderWrapper({ children }: { children: React.ReactNode }) {
  const { effectiveProfile } = useProfile();

  // For guest mode (no session), profileId should be null, not undefined
  const profileId = effectiveProfile?.id ?? null;

  return (
    <WebSocketProvider profileId={profileId}>{children}</WebSocketProvider>
  );
}

export function MainLayoutClient({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial: LayoutContextResponse;
}) {
  return (
    <ProfileProviderClient initial={initial}>
      <WebSocketProviderWrapper>
        <TourProvider>
          <BreadcrumbProvider>
            <AnalyticsProvider>
              <MainLayoutContent>{children}</MainLayoutContent>
            </AnalyticsProvider>
          </BreadcrumbProvider>
        </TourProvider>
      </WebSocketProviderWrapper>
    </ProfileProviderClient>
  );
}
