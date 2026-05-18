/**
 * FullPageSkeleton — loading skeleton that mirrors FullPageLayout's structure.
 *
 * Reads cookie state for sidebar/panel open to match the real layout exactly,
 * preventing layout shift. Used by loading.tsx files in migrated pages.
 *
 * Interface: sidebarOpen (left), panelOpen (right), children (content skeleton).
 */
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReactNode } from "react";

// Match sidebar.tsx constants
const SIDEBAR_WIDTH = "16rem";
const PANEL_WIDTH = "18rem";

interface FullPageSkeletonProps {
  sidebarOpen?: boolean;
  panelOpen?: boolean;
  children: ReactNode;
}

function HeaderSkeleton() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
      <div className="flex items-center gap-2 px-4 flex-1">
        <Skeleton className="h-6 w-6 rounded" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Skeleton className="h-4 w-44 rounded" />
      </div>
    </header>
  );
}

function PanelSkeleton() {
  return (
    <div
      className="flex-none border-l bg-sidebar"
      style={{ width: PANEL_WIDTH }}
    >
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="ml-auto h-4 w-4" />
        </div>
        <Skeleton className="h-3 w-16 mt-1" />
      </div>
      {/* Content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-3 pt-8">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function FullPageSkeleton({
  sidebarOpen = true,
  panelOpen = false,
  children,
}: FullPageSkeletonProps) {
  return (
    <div className="flex min-h-svh w-full">
      {/* Left sidebar — plain divs to avoid SidebarProvider dependency */}
      <div
        className="flex-none hidden md:flex flex-col border-r bg-sidebar"
        style={{ width: sidebarOpen ? SIDEBAR_WIDTH : "3rem" }}
      >
        {/* Profile switcher */}
        <div className="p-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            {sidebarOpen && (
              <>
                <div className="flex flex-col gap-0.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="ml-auto h-4 w-4" />
              </>
            )}
          </div>
        </div>
        {/* Search */}
        {sidebarOpen && (
          <div className="px-3 pb-2">
            <Skeleton className="h-9 w-full" />
          </div>
        )}
        {/* Nav items */}
        <div className="flex-1 px-3 space-y-4 pt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 flex-shrink-0" />
              {sidebarOpen && <Skeleton className="h-4 w-20" />}
            </div>
          ))}
        </div>
        {/* Footer */}
        <div className="p-3 border-t">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            {sidebarOpen && (
              <div className="flex flex-col gap-0.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0">
        <HeaderSkeleton />
        <div className="flex flex-1 flex-col gap-4">{children}</div>
      </div>

      {/* Right panel */}
      {panelOpen && <PanelSkeleton />}
    </div>
  );
}
