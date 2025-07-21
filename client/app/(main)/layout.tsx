/**
 * app/(main)/layout.tsx
 * Layout for the main section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Pencil, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useMemo } from "react";

import ChatDialog from "@/components/common/home/ChatDialog";
import ChatFab from "@/components/common/home/ChatFab";
import ChatWidget from "@/components/common/home/ChatWidget";
import { NavigationBreadcrumbs } from "@/components/common/layout/NavigationBreadcrumbs";
import { UnifiedSidebar } from "@/components/common/layout/UnifiedSidebar";
import { AssistantProvider } from "@/contexts/assistant-context";
import { useProfile } from "@/contexts/profile-context";
import {
  SimulationProvider,
  useSimulation,
} from "@/contexts/simulation-context";
import { TourProvider, useTour } from "@/contexts/tour-context";
import {
  generateEnhancedBreadcrumbs,
  getActiveSectionFromPath,
} from "@/utils/breadcrumb-utils";
import {
  createSectionChangeHandler,
  isMainScreen,
} from "@/utils/navigation-utils";

// Guide Button Component
function GuideButton() {
  const { state, openGuide } = useTour();
  const { effectiveProfile } = useProfile();

  // Show guide button when tour is not complete and not currently open
  const shouldShow =
    effectiveProfile &&
    (!effectiveProfile.viewedIntro || !effectiveProfile.viewedChat) &&
    !state.isOpen;

  if (!shouldShow) return null;

  return (
    <button
      onClick={openGuide}
      className="fixed bottom-6 right-6 z-50 bg-primary text-primary-foreground rounded-full p-4 shadow-lg hover:bg-primary/90 transition-colors"
      aria-label="Open tour guide"
    >
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </button>
  );
}

// Inner component that uses the role context
function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { effectiveProfile } = useProfile();

  // Role context is available for child components
  const activeSection = getActiveSectionFromPath(pathname);
  const [breadcrumbs, setBreadcrumbs] = React.useState<
    Array<{ title: string; section?: string }>
  >([]);
  const simulationContext = useSimulation();

  // Check if we're on a main screen that should show chat components
  const shouldShowChatComponents = useMemo(() => {
    return isMainScreen(pathname);
  }, [pathname]);

  // Load enhanced breadcrumbs with async ID resolution
  React.useEffect(() => {
    const loadBreadcrumbs = async () => {
      const enhancedBreadcrumbs = await generateEnhancedBreadcrumbs(pathname);
      setBreadcrumbs(enhancedBreadcrumbs);
    };
    loadBreadcrumbs();
  }, [pathname]);

  const handleSectionChange = createSectionChangeHandler(router);

  // Determine action button based on current path
  const getActionButton = () => {
    // Don't show create buttons on the creation pages themselves
    if (
      pathname.includes("/t/") ||
      pathname.includes("/s/") ||
      pathname.includes("/p/") ||
      pathname.includes("/u/")
    ) {
      return null;
    }

    if (simulationContext) {
      const {
        endChat,
        endChatLoading,
        isSingleChatAttempt,
        isLastAttempt,
        simulation,
        isActive,
      } = simulationContext;

      let buttonLabel = "End Chat";
      if (isSingleChatAttempt) {
        buttonLabel = "End Session";
      } else if (isLastAttempt) {
        buttonLabel = "End Session";
      } else {
        buttonLabel = "End & Next Chat";
      }

      return (
        <Button
          type="button"
          variant="outline"
          onClick={endChat}
          disabled={
            endChatLoading || (simulation?.timeLimit ? !isActive : false)
          }
          className="whitespace-nowrap min-h-[40px] h-[40px] px-4 text-sm"
          data-tour-end-chat
        >
          {endChatLoading ? "Ending..." : buttonLabel}
        </Button>
      );
    }

    if (pathname === "/analytics/dashboard") {
      return (
        <Button
          onClick={() => router.push("/analytics/dashboard/edit")}
          size="sm"
        >
          <Pencil className="h-4 w-4 mr-2" />
          Edit Dashboard
        </Button>
      );
    }

    if (pathname === "/cohorts") {
      return (
        <Button onClick={() => router.push("/cohorts/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Cohort
        </Button>
      );
    }

    if (pathname === "/classes") {
      return (
        <Button onClick={() => router.push("/classes/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Class
        </Button>
      );
    }

    // Check for individual class page pattern: /classes/new/c/[classId]
    const cohortsPageMatch = pathname.match(
      /^\/create\/cohorts\/new\/c\/([^\/]+)(?:\/.*)?$/
    );
    if (
      cohortsPageMatch &&
      effectiveProfile?.role !== "guest" &&
      effectiveProfile.role !== "ta"
    ) {
      const cohortId = cohortsPageMatch[1];
      return (
        <Button
          onClick={() => router.push(`/cohorts/c/${cohortId}/edit`)}
          size="sm"
          variant="default"
        >
          <Pencil className="h-4 w-4 mr-2" />
          Edit Cohort
        </Button>
      );
    }

    // Check for individual class page pattern: /classes/new/c/[classId]
    const classPageMatch = pathname.match(
      /^\/create\/classes\/new\/c\/([^\/]+)(?:\/.*)?$/
    );
    if (
      classPageMatch &&
      effectiveProfile?.role !== "guest" &&
      effectiveProfile.role !== "ta"
    ) {
      const classId = classPageMatch[1];
      return (
        <Button
          onClick={() => router.push(`/classes/c/${classId}/edit`)}
          size="sm"
          variant="default"
        >
          <Pencil className="h-4 w-4 mr-2" />
          Edit Class
        </Button>
      );
    }

    if (pathname === "/create/agents") {
      return (
        <Button onClick={() => router.push("/create/agents/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Agent
        </Button>
      );
    }

    if (pathname === "/create/rubrics") {
      return (
        <Button onClick={() => router.push("/create/rubrics/new")} size="sm">
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
      return (
        <Button onClick={() => router.push("/management/staff/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Staff
        </Button>
      );
    }

    if (pathname === "/management/departments") {
      return (
        <Button
          onClick={() => router.push("/management/departments/new")}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Department
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

    if (!shouldShowChatComponents) {
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

            {actionButton && <div className="px-4">{actionButton}</div>}
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
        </SidebarInset>
      </SidebarProvider>

      {/* Chat Components - Only show on main screens defined in the sidebar */}
      {shouldShowChatComponents && (
        <>
          <ChatFab up={false} />
          <ChatWidget up={false} />
          <ChatDialog />
        </>
      )}

      {/* Guide Button - Always visible when tour is not complete */}
      {effectiveProfile?.role === "ta" && <GuideButton />}
    </AssistantProvider>
  );
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const attemptId = useMemo(() => {
    const match = pathname?.match(/^\/home\/a\/([^\/]+)/);
    return match ? match[1] : null;
  }, [pathname]);

  // If we have an attemptId, wrap the content in the provider.
  // Otherwise, render the content directly.
  return (
    <TourProvider>
      {attemptId ? (
        <SimulationProvider attemptId={attemptId}>
          <MainLayoutContent>{children}</MainLayoutContent>
        </SimulationProvider>
      ) : (
        <MainLayoutContent>{children}</MainLayoutContent>
      )}
    </TourProvider>
  );
}
