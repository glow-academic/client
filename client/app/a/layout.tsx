/**
 * app/a/layout.tsx
 * Layout for the a section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";
import React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { UnifiedSidebar } from "@/components/common/layout/unified-sidebar";
import { NavigationBreadcrumbs } from "@/components/common/layout/navigation-breadcrumbs";
import {
  generateEnhancedBreadcrumbs,
  getActiveSectionFromPath,
} from "@/utils/breadcrumb-utils";
import { createSectionChangeHandler } from "@/utils/navigation-utils";
import { Clock } from "lucide-react";

type WindowWithAttemptTimer = Window &
  typeof globalThis & {
    attemptTimer: {
      timeRemaining: number | null;
      formatTime: (seconds: number) => string;
      isActive: boolean;
      showResults: boolean;
      hasTimeLimit: boolean;
    };
  };

export default function AttemptLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const activeSection = getActiveSectionFromPath(pathname);
  const [breadcrumbs, setBreadcrumbs] = React.useState<
    Array<{ title: string; section?: string }>
  >([]);
  const [timerData, setTimerData] = React.useState<{
    timeRemaining: number | null;
    formatTime: (seconds: number) => string;
    isActive: boolean;
    showResults: boolean;
    hasTimeLimit: boolean;
  } | null>(null);

  // Load enhanced breadcrumbs with async ID resolution
  React.useEffect(() => {
    const loadBreadcrumbs = async () => {
      const enhancedBreadcrumbs = await generateEnhancedBreadcrumbs(pathname);
      setBreadcrumbs(enhancedBreadcrumbs);
    };
    loadBreadcrumbs();
  }, [pathname]);

  // Listen for timer updates from the attempt page
  React.useEffect(() => {
    const checkTimer = () => {
      if (
        typeof window !== "undefined" &&
        (window as WindowWithAttemptTimer).attemptTimer
      ) {
        setTimerData((window as WindowWithAttemptTimer).attemptTimer);
      }
    };

    // Check immediately
    checkTimer();

    // Set up interval to check for timer updates
    const interval = setInterval(checkTimer, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleSectionChange = createSectionChangeHandler(router);

  return (
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

          {/* Timer in top right corner */}
          {timerData && !timerData.showResults && (
            <div className="flex items-center gap-2 bg-muted px-3 py-1 rounded-full mr-4">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium" data-testid="timer">
                {timerData.hasTimeLimit && timerData.timeRemaining !== null
                  ? timerData.formatTime(timerData.timeRemaining)
                  : "No time limit"}
              </span>
              {timerData.hasTimeLimit && !timerData.isActive && (
                <span className="text-xs text-red-500 ml-1">(Expired)</span>
              )}
            </div>
          )}
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
