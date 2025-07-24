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
import { Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useMemo } from "react";

import ChatDialog from "@/components/common/home/ChatDialog";
import ChatFab from "@/components/common/home/ChatFab";
import ChatWidget from "@/components/common/home/ChatWidget";
import { NavigationBreadcrumbs } from "@/components/common/layout/NavigationBreadcrumbs";
import { UnifiedSidebar } from "@/components/common/layout/UnifiedSidebar";
import TATour from "@/components/home/TATour";
import { AssistantProvider } from "@/contexts/assistant-context";
import { useProfile } from "@/contexts/profile-context";
import {
  SimulationProvider,
  useSimulation,
} from "@/contexts/simulation-context";
import { TourProvider } from "@/contexts/tour-context";
import {
  generateEnhancedBreadcrumbs,
  getActiveSectionFromPath,
} from "@/utils/breadcrumb-utils";
import {
  createSectionChangeHandler,
  isMainScreen,
} from "@/utils/navigation-utils";

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

  // Check if user has permission to see chat components (instructional, admin, superadmin only)
  const canShowChatComponents = useMemo(() => {
    const allowedRoles = ["instructional", "admin", "superadmin"];
    return (
      effectiveProfile?.role && allowedRoles.includes(effectiveProfile.role)
    );
  }, [effectiveProfile?.role]);

  // Load enhanced breadcrumbs with async ID resolution
  React.useEffect(() => {
    const loadBreadcrumbs = async () => {
      const enhancedBreadcrumbs = await generateEnhancedBreadcrumbs(pathname);
      setBreadcrumbs(enhancedBreadcrumbs);
    };
    loadBreadcrumbs();
  }, [pathname]);

  const handleSectionChange = createSectionChangeHandler(router, pathname);

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

            {actionButton && <div className="px-4">{actionButton}</div>}
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
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

      {/* Tour Component - Available globally for TA users */}
      {effectiveProfile?.role === "ta" && <TATour />}
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
    const match = pathname?.match(/^\/(?:home|practice)\/a\/([^\/]+)/);
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
