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
import { useRole } from "@/contexts/role-context";
import {
  SimulationProvider,
  useSimulation,
} from "@/contexts/simulation-context";
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
  const { effectiveRole } = useRole();

  // Role context is available for child components
  const activeSection = getActiveSectionFromPath(pathname);
  const [breadcrumbs, setBreadcrumbs] = React.useState<
    Array<{ title: string; section?: string }>
  >([]);
  const simulationContext = useSimulation();

  // Check if we're on a main screen that should show chat components
  const shouldShowChatComponents = useMemo(() => {
    return isMainScreen(pathname, effectiveRole);
  }, [pathname, effectiveRole]);

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

    // Check for individual class page pattern: /create/classes/new/c/[classId]
    const classPageMatch = pathname.match(
      /^\/create\/classes\/new\/c\/([^\/]+)(?:\/.*)?$/
    );
    if (classPageMatch) {
      const classId = classPageMatch[1];
      return (
        <Button
          onClick={() => router.push(`/create/classes/c/${classId}/edit`)}
          size="sm"
          variant="default"
        >
          <Pencil className="h-4 w-4 mr-2" />
          Edit Class
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

    if (pathname === "/create/simulations/agents") {
      return (
        <Button
          onClick={() => router.push("/simulations/agents/new")}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Agent
        </Button>
      );
    }

    if (pathname === "/create/classes") {
      return (
        <Button onClick={() => router.push("/create/classes/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Class
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

    if (pathname === "/management/staff") {
      return (
        <Button onClick={() => router.push("/management/staff/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Staff Member
        </Button>
      );
    }

    if (pathname === "/management/evals") {
      return (
        <Button onClick={() => router.push("/management/evals/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Evaluation
        </Button>
      );
    }

    if (pathname === "/create/cohorts") {
      return (
        <Button onClick={() => router.push("/create/cohorts/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Cohort
        </Button>
      );
    }

    if (pathname === "/management/models") {
      return (
        <Button onClick={() => router.push("/management/models/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Model
        </Button>
      );
    }

    if (
      pathname.startsWith("/management/evals/e/") &&
      !pathname.includes("/r/")
    ) {
      return (
        <Button onClick={() => router.push(`${pathname}/edit`)} size="sm">
          <Pencil className="h-4 w-4 mr-2" />
          Edit Evaluation
        </Button>
      );
    }

    if (pathname === "/management/models") {
      return (
        <Button onClick={() => router.push("/management/models/new")} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Model
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
    <>
      {attemptId ? (
        <SimulationProvider attemptId={attemptId}>
          <MainLayoutContent>{children}</MainLayoutContent>
        </SimulationProvider>
      ) : (
        <MainLayoutContent>{children}</MainLayoutContent>
      )}
    </>
  );
}
