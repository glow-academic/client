/**
 * UnifiedSidebar.tsx
 * Used to display the sidebar for the application
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
import type {
  AuthPageResponse,
  CreateFeedbackIn,
  CreateFeedbackOut,
  SearchSimulatableProfilesIn,
  SearchSimulatableProfilesOut,
  SwitchEffectiveProfileParams,
  SwitchEffectiveProfileResult,
} from "@/app/(main)/layout-server";
import ReportProblem from "@/components/common/layout/ReportProblem";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useProfile } from "@/contexts/profile-context";
import { useFederatedLogout } from "@/hooks/useFederatedLogout";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ChevronRight,
  ChevronsUpDown,
  ClipboardList,
  Gauge,
  GraduationCap,
  Home,
  LogOut,
  PieChart,
  Search,
  Server,
  Settings,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EmulateProfileModal } from "./EmulateProfileModal";
import { SidebarSkeleton } from "./SidebarSkeleton";

export interface UnifiedSidebarProps
  extends React.ComponentProps<typeof Sidebar> {
  sidebarRoutes: AuthPageResponse["sidebar_routes"];
  activeSection: string;
  onSectionChange?: (section: string) => void;
  switchEffectiveProfile: (
    input: SwitchEffectiveProfileParams
  ) => Promise<SwitchEffectiveProfileResult>;
  createFeedback: (input: CreateFeedbackIn) => Promise<CreateFeedbackOut>;
  searchSimulatableProfiles: (
    input: SearchSimulatableProfilesIn
  ) => Promise<SearchSimulatableProfilesOut>;
}

interface ClassData {
  id: string;
  classCode: string;
}

interface MenuItem {
  title: string;
  url: string;
  section?: string;
  classData?: ClassData;
  isSubItem?: boolean;
}

interface NavSection {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  items?: MenuItem[];
  section?: string;
}

// Icon map: resolves Lucide icon name string → React component
const NAV_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home,
  target: Target,
  trophy: Trophy,
  "pie-chart": PieChart,
  "graduation-cap": GraduationCap,
  "clipboard-list": ClipboardList,
  sparkles: Sparkles,
  server: Server,
  activity: Activity,
  gauge: Gauge,
  settings: Settings,
};

// Helper function to get initials from name
const getInitials = (name?: string): string => {
  if (!name) return "??";
  return name
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export function UnifiedSidebar({
  sidebarRoutes,
  activeSection,
  onSectionChange,
  switchEffectiveProfile,
  createFeedback,
  searchSimulatableProfiles,
  ...props
}: UnifiedSidebarProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isEmulateModalOpen, setIsEmulateModalOpen] = useState(false);
  const federatedLogout = useFederatedLogout();

  // Preserve scroll position across navigation
  const savedScrollPositionRef = useRef<number | null>(null);
  const isRestoringScrollRef = useRef<boolean>(false);
  const getScrollContainer = () => {
    // Find the scrollable SidebarContent element by data attribute
    return document.querySelector(
      '[data-sidebar="content"]'
    ) as HTMLDivElement | null;
  };

  // Get sidebar context to close mobile sidebar on navigation
  const { isMobile, setOpenMobile } = useSidebar();

  // Use the profile context
  const { profile, isAuthenticated } =
    useProfile();

  // Convert server-driven sidebar routes into NavSection format with search filtering
  const navMain = useMemo(() => {
    if (!profile || !sidebarRoutes) return [];

    const menu: NavSection[] = sidebarRoutes.map((section) => {
      const IconComponent = NAV_ICON_MAP[section.icon] || Home;
      const items: MenuItem[] | undefined = section.items
        ? section.items.map((item) => ({
            title: item.title,
            url: item.url,
            section: item.section,
          }))
        : undefined;

      return {
        title: section.title,
        url: section.url,
        icon: IconComponent,
        section: section.section,
        items,
      };
    });

    // Apply search filter if search term exists
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      return menu
        .map((section) => {
          if (section.section && !section.items) {
            const matchesSearch =
              section.title.toLowerCase().includes(searchLower) ||
              section.section.toLowerCase().includes(searchLower);
            return matchesSearch ? section : null;
          }
          const filteredItems =
            section.items?.filter(
              (item) =>
                item.title.toLowerCase().includes(searchLower) ||
                item.section?.toLowerCase().includes(searchLower)
            ) || [];
          const sectionMatches = section.title
            .toLowerCase()
            .includes(searchLower);
          if (filteredItems.length > 0 || sectionMatches) {
            return { ...section, items: filteredItems };
          }
          return null;
        })
        .filter((section): section is NavSection => section !== null);
    }

    return menu;
  }, [profile, searchTerm, sidebarRoutes]);

  // Resolve the href for any menu item (for use with <Link>)
  const getItemHref = useCallback(
    (item: MenuItem): string => {
      if (item.url && item.url !== "#") {
        return item.url;
      }
      return "#";
    },
    []
  );

  const handleItemClick = useCallback(
    (e: React.MouseEvent, item: MenuItem) => {
      // Let browser handle Cmd+Click / Ctrl+Click / middle-click natively (opens in new tab)
      if (e.metaKey || e.ctrlKey || e.button === 1) return;

      // Prevent rapid navigation clicks that could cause freezing
      if (isNavigating) {
        e.preventDefault();
        return;
      }

      // Store scroll position before navigation to preserve it across re-renders
      const scrollContainer = getScrollContainer();
      const scrollBefore = scrollContainer?.scrollTop ?? null;
      if (scrollBefore !== null && scrollBefore > 0) {
        savedScrollPositionRef.current = scrollBefore;
        sessionStorage.setItem("sidebar-scroll-position", String(scrollBefore));
        sessionStorage.setItem("sidebar-is-restoring", "true");
        isRestoringScrollRef.current = true;
      }

      setIsNavigating(true);

      if (onSectionChange && item.section) {
        // If parent provided an onSectionChange callback, prevent Link navigation
        // and use the callback instead
        e.preventDefault();
        onSectionChange(item.section);
      } else {
        // Let <Link> handle client-side navigation, but also trigger refresh
        // for server component re-render
        router.refresh();
      }

      // Close mobile sidebar after navigation
      if (isMobile) {
        setOpenMobile(false);
      }

      // Reset navigation state after a short delay
      setTimeout(() => setIsNavigating(false), 500);
    },
    [router, onSectionChange, isNavigating, isMobile, setOpenMobile]
  );

  // Check if user can emulate (instructional and higher, and must be authenticated)
  // Guest/default account users can't emulate even if they have the right role
  const canEmulate = isAuthenticated && !!profile;

  // Restore scroll position synchronously before paint to prevent flash
  useLayoutEffect(() => {
    const savedScrollFromStorage = sessionStorage.getItem(
      "sidebar-scroll-position"
    );
    const isRestoringFromStorage =
      sessionStorage.getItem("sidebar-is-restoring") === "true";

    if (savedScrollFromStorage && isRestoringFromStorage) {
      const savedScroll = Number(savedScrollFromStorage);
      const scrollContainer = getScrollContainer();

      if (scrollContainer && savedScroll > 0) {
        scrollContainer.scrollTop = savedScroll;
        // Clear saved position after restoration
        sessionStorage.removeItem("sidebar-scroll-position");
        sessionStorage.removeItem("sidebar-is-restoring");
        savedScrollPositionRef.current = null;
        isRestoringScrollRef.current = false;
      }
    }
  }, [activeSection]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const handleLoginOrLogout = async () => {
    // Handle logout for all users including guests
    setIsLoggingOut(true);

    toast.promise(
      async () => {
        try {
          await federatedLogout();
          return "Logged out successfully";
        } catch (error) {
          throw new Error(
            typeof error === "string" ? error : "Failed to log out"
          );
        } finally {
          setIsLoggingOut(false);
        }
      },
      {
        loading: "Logging out...",
        success: (message) => message,
        error: (error) => error.message || "Failed to log out",
      }
    );
  };

  const shouldShowSkeleton = !profile;

  if (shouldShowSkeleton) {
    return <SidebarSkeleton />;
  }

  return (
    <>
      <Sidebar {...props}>
        <SidebarHeader>
          {/* Profile Dropdown */}
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar
                      className="h-8 w-8 outline outline-muted-foreground"
                      style={{ outlineWidth: "1px", outlineStyle: "solid" }}
                    >
                      <AvatarFallback>
                        {!profile ? "GU" : getInitials(profile?.name || "")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-0.5 leading-none text-left">
                      <span className="font-medium truncate">
                        {profile?.name || "Guest User"}
                      </span>
                      {/* Capitalize the role for display */}
                      <span className="text-xs capitalize">
                        {profile?.role || "guest"}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  align="start"
                >
                  {canEmulate ? (
                    <>
                      <DropdownMenuItem
                        onClick={() => setIsEmulateModalOpen(true)}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Emulate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  <DropdownMenuItem
                    onClick={handleLoginOrLogout}
                    disabled={isLoggingOut}
                    className={
                      isLoggingOut ? "opacity-70 cursor-not-allowed" : ""
                    }
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    {isLoggingOut ? "Logging out..." : "Logout"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>

          {/* Search Form */}
          <SidebarGroup className="py-0">
            <SidebarGroupContent className="relative">
              <Label htmlFor="search" className="sr-only">
                Search
              </Label>
              <SidebarInput
                id="search"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8"
              />
              <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarHeader>

        <SidebarContent className="gap-0">
          {navMain.map((item) => {
            // If item has no sub-items and has a section, render as standalone menu item
            if (!item.items && item.section) {
              return (
                <SidebarGroup key={item.title}>
                  <SidebarGroupLabel
                    asChild
                    className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm font-medium cursor-pointer"
                  >
                    <Link
                      href={getItemHref({
                        title: item.title,
                        url: item.url,
                        section: item.section!,
                      })}
                      onClick={(e) =>
                        handleItemClick(e, {
                          title: item.title,
                          url: item.url,
                          section: item.section!,
                        })
                      }
                      className={`flex items-center gap-2 px-2 py-1.5 ${activeSection === item.section ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.title}
                    </Link>
                  </SidebarGroupLabel>
                </SidebarGroup>
              );
            }

            // Otherwise render as collapsible section with sub-items
            return (
              <Collapsible
                key={item.title}
                title={item.title}
                defaultOpen
                className="group/collapsible"
              >
                <SidebarGroup>
                  <SidebarGroupLabel
                    asChild
                    className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm"
                  >
                    <CollapsibleTrigger>
                      <item.icon className="h-4 w-4 mr-2" />
                      {item.title}
                      <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {item.items?.map((subItem: MenuItem) => (
                          <SidebarMenuItem key={subItem.title}>
                            <SidebarMenuButton
                              asChild
                              isActive={activeSection === subItem.section}
                              className={`${subItem.isSubItem ? "pl-8 text-sm" : "pl-8"}`}
                            >
                              <Link
                                href={getItemHref(subItem)}
                                onClick={(e) => handleItemClick(e, subItem)}
                              >
                                {subItem.title}
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          })}
        </SidebarContent>

        {/* Report Problem Button in Footer */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="px-2 pb-2">
                <ReportProblem createFeedback={createFeedback}>
                  <Button variant="outline" className="w-full">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Report Problem
                  </Button>
                </ReportProblem>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* Emulate Profile Modal */}
      <EmulateProfileModal
        open={isEmulateModalOpen}
        onOpenChange={setIsEmulateModalOpen}
        searchSimulatableProfiles={searchSimulatableProfiles}
        switchEffectiveProfile={switchEffectiveProfile}
      />
    </>
  );
}
