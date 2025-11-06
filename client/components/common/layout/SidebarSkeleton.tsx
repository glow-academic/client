/**
 * SidebarSkeleton.tsx
 * Server component skeleton for the sidebar
 * Extracted from UnifiedSidebar to allow server component imports
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
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
import { Search } from "lucide-react";

export function SidebarSkeleton() {
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
        {/* Navigation sections skeleton */}
        {[1, 2, 3, 4, 5].map((i) => (
          <SidebarGroup key={i}>
            <SidebarGroupLabel className="group/label text-sidebar-foreground text-sm font-medium">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-20" />
              </div>
            </SidebarGroupLabel>
          </SidebarGroup>
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
