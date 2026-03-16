/**
 * AppShell.tsx
 * Reusable skeleton components for consistent loading states
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Search } from "lucide-react";
import { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  // Server wrapper that just renders children; keeps things tidy
  return <>{children}</>;
}

// Sidebar skeleton component (inlined for AppShell use)
function SidebarSkeleton() {
  return (
    <Sidebar>
      <SidebarHeader>
        {/* Profile Switcher Skeleton */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" disabled>
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex flex-col gap-0.5 leading-none text-left">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="ml-auto h-4 w-4" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Search Form Skeleton */}
        <SidebarGroup className="py-0">
          <SidebarGroupContent className="relative">
            <Skeleton className="h-9 w-full pl-8" />
            <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {/* Standalone navigation items skeleton (e.g., Home, Practice) */}
        {[1, 2].map((i) => (
          <SidebarGroup key={`standalone-${i}`}>
            <SidebarGroupLabel
              asChild
              className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm font-medium cursor-pointer"
            >
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-20" />
              </div>
            </SidebarGroupLabel>
          </SidebarGroup>
        ))}

        {/* Collapsible sections skeleton (e.g., Analytics, Create, Management) */}
        {[1, 2, 3].map((i) => (
          <Collapsible
            key={`collapsible-${i}`}
            defaultOpen
            className="group/collapsible"
          >
            <SidebarGroup>
              <SidebarGroupLabel
                asChild
                className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm"
              >
                <CollapsibleTrigger>
                  <Skeleton className="h-4 w-4 mr-2" />
                  <Skeleton className="h-4 w-24" />
                  <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {[1, 2, 3, 4].map((j) => (
                      <SidebarMenuItem key={`subitem-${i}-${j}`}>
                        <SidebarMenuButton disabled className="pl-8">
                          <Skeleton className="h-4 w-32" />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>

      {/* Footer Skeleton */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="px-2 pb-2">
              <div className="relative group">
                <div className="relative border border-blue-500 dark:border-purple-600 rounded-lg px-4 py-2.5">
                  <div className="flex items-center justify-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              </div>
            </div>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton size="lg" disabled>
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="ml-auto h-4 w-4" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

// Header skeleton used during loading. Matches header structure from layout-client.tsx
function HeaderSkeleton() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4 flex-1">
        {/* SidebarTrigger skeleton */}
        <Skeleton className="h-6 w-6 rounded" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        {/* Breadcrumbs skeleton */}
        <Skeleton className="h-4 w-44 rounded" />
      </div>
      {/* Optional filters/controls skeleton */}
      <div className="pr-4">
        <Skeleton className="h-8 w-56 rounded" />
      </div>
    </header>
  );
}

// Content skeleton shown while page content is fetching
export function ContentSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Skeleton className="h-8 w-64 rounded" />
      <Skeleton className="h-32 rounded" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-24 rounded" />
        <Skeleton className="h-24 rounded" />
        <Skeleton className="h-24 rounded" />
      </div>
    </div>
  );
}

// Full shell skeleton that shows sidebar skeleton + header skeleton + content skeleton
export function FullShellSkeleton() {
  return (
    <>
      <SidebarSkeleton />
      <div className="flex min-h-screen flex-1 flex-col">
        <HeaderSkeleton />
        <ContentSkeleton />
      </div>
    </>
  );
}

// Export as static properties for convenience
AppShell.ContentSkeleton = ContentSkeleton;
AppShell.FullShellSkeleton = FullShellSkeleton;
