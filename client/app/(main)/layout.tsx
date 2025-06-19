/**
 * app/(main)/layout.tsx
 * Layout for the main section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";
import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Pencil, Plus, X } from "lucide-react";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

import { UnifiedSidebar } from "@/components/common/layout/unified-sidebar";
import { NavigationBreadcrumbs } from "@/components/common/layout/navigation-breadcrumbs";
import {
  generateEnhancedBreadcrumbs,
  getActiveSectionFromPath,
} from "@/utils/breadcrumb-utils";
import { createSectionChangeHandler } from "@/utils/navigation-utils";
import { useDashboard } from "@/contexts/dashboard-context";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isEditMode, setIsEditMode } = useDashboard();
  const activeSection = getActiveSectionFromPath(pathname);
  const [breadcrumbs, setBreadcrumbs] = React.useState<
    Array<{ title: string; section?: string }>
  >([]);

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

    if (pathname === "/analytics/dashboard") {
      if (isEditMode) {
        return (
          <Button onClick={() => setIsEditMode(true)} size="sm">
            <Pencil className="h-4 w-4 mr-2" />
            Edit Dashboard
          </Button>
        );
      } else {
        return (
          <Button onClick={() => setIsEditMode(false)} size="sm">
            <X className="h-4 w-4 mr-2" />
            Exit
          </Button>
        );
      }
    }

    // Check for individual class page pattern: /classes/c/[classId]
    const classPageMatch = pathname.match(/^\/classes\/c\/([^\/]+)(?:\/.*)?$/);
    if (classPageMatch && !pathname.includes("/edit")) {
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

    if (pathname === "/create/rubrics") {
      return (
        <Button onClick={() => router.push("/create/rubrics/new")} size="sm">
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

    if (pathname === "/create/agents") {
      return (
        <Button onClick={() => router.push("/create/agents/new")} size="sm">
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

    if (pathname === "/management/cohorts") {
      return (
        <Button
          onClick={() => router.push("/management/cohorts/new")}
          size="sm"
        >
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

    return null;
  };

  const actionButton = getActionButton();

  const content = (
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
  );

  return content;
}
