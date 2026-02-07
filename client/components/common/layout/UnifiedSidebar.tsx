/**
 * UnifiedSidebar.tsx
 * Used to display the sidebar for the application
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
import type {
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
import { getSectionRoute } from "@/utils/navigation-utils";
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
  const { profile, isLoading, availableSections, isAuthenticated } =
    useProfile();

  // Build navigation menu based on role with search filtering
  const navMain = useMemo(() => {
    if (!profile) return [];

    const menu: NavSection[] = [];
    // Use server-provided available sections from profile context

    // Home - Only for non guest users
    if (availableSections.includes("home")) {
      menu.push({
        title: "Home",
        url: "#",
        icon: Home,
        section: "home",
      });
    }
    // Practice - all users
    if (availableSections.includes("practice")) {
      menu.push({
        title: "Practice",
        url: "#",
        icon: Target,
        section: "practice",
      });
    }

    // Leaderboard - Available for all authorized users as root-level item
    if (availableSections.includes("leaderboard")) {
      menu.push({
        title: "Leaderboard",
        url: "#",
        icon: Trophy,
        section: "leaderboard",
      });
    }

    // Analytics - Available from instructional level and up
    // Check for parent section "analytics" - if present, show all subsections
    if (
      profile.role &&
      ["instructional", "admin", "superadmin"].includes(profile.role) &&
      availableSections.includes("analytics")
    ) {
      const analyticsItems: MenuItem[] = [];

      // Show all analytics subsections when parent section is available
      analyticsItems.push({
        title: "Dashboard",
        url: "#",
        section: "dashboard",
      });
      analyticsItems.push({
        title: "Reports",
        url: "#",
        section: "reports",
      });
      analyticsItems.push({
        title: "Activity",
        url: "#",
        section: "activity",
      });
      analyticsItems.push({
        title: "Pricing",
        url: "#",
        section: "pricing",
      });

      menu.push({
        title: "Analytics",
        url: "#",
        icon: PieChart,
        items: analyticsItems,
      });
    }

    // Training - Available from instructor level and up
    // Check for parent section "training" - if present, show all subsections
    if (availableSections.includes("training")) {
      const trainingItems: MenuItem[] = [];

      // Show all training subsections when parent section is available
      trainingItems.push({
        title: "Cohorts",
        url: "#",
        section: "cohorts",
      });
      trainingItems.push({
        title: "Simulations",
        url: "#",
        section: "simulations",
      });
      trainingItems.push({
        title: "Scenarios",
        url: "#",
        section: "scenarios",
      });
      trainingItems.push({
        title: "Personas",
        url: "#",
        section: "personas",
      });

      menu.push({
        title: "Training",
        url: "#",
        icon: GraduationCap,
        items: trainingItems,
      });
    }

    // Management - Available from admin level and up
    // Check for parent section "management" - if present, show all subsections
    if (availableSections.includes("management")) {
      const managementItems: MenuItem[] = [];

      // Show all management subsections when parent section is available
      managementItems.push({
        title: "Staff",
        url: "#",
        section: "staff",
      });
      managementItems.push({
        title: "Documents",
        url: "#",
        section: "documents",
      });
      managementItems.push({
        title: "Parameters",
        url: "#",
        section: "parameters",
      });
      managementItems.push({
        title: "Fields",
        url: "#",
        section: "fields",
      });

      menu.push({
        title: "Management",
        url: "#",
        icon: ClipboardList,
        items: managementItems,
      });
    }

    // Intelligence - Available for admin and superadmin
    // Check for parent section "intelligence" - if present, show all subsections
    if (
      (profile.role === "admin" || profile.role === "superadmin") &&
      availableSections.includes("intelligence")
    ) {
      const intelligenceItems: MenuItem[] = [];

      // Show all intelligence subsections when parent section is available
      intelligenceItems.push({
        title: "Agents",
        url: "#",
        section: "agents",
      });
      intelligenceItems.push({
        title: "Models",
        url: "#",
        section: "models",
      });
      intelligenceItems.push({
        title: "Rubrics",
        url: "#",
        section: "rubrics",
      });
      intelligenceItems.push({
        title: "Tools",
        url: "#",
        section: "tools",
      });

      menu.push({
        title: "Intelligence",
        url: "#",
        icon: Sparkles,
        items: intelligenceItems,
      });
    }

    // System - Available for superadmin only
    // Check for parent section "system" - if present, show all subsections
    if (profile.role === "superadmin" && availableSections.includes("system")) {
      const systemItems: MenuItem[] = [];

      // Show all system subsections when parent section is available
      systemItems.push({
        title: "Departments",
        url: "#",
        section: "departments",
      });
      systemItems.push({
        title: "Providers",
        url: "#",
        section: "providers",
      });
      systemItems.push({
        title: "Auth",
        url: "#",
        section: "auth",
      });
      systemItems.push({
        title: "Evals",
        url: "#",
        section: "evals",
      });

      menu.push({
        title: "System",
        url: "#",
        icon: Server,
        items: systemItems,
      });
    }

    // Health - Available for superadmin only, top-level
    if (profile.role === "superadmin" && availableSections.includes("health")) {
      menu.push({
        title: "Health",
        url: "#",
        icon: Activity,
        section: "health",
      });
    }

    // Benchmark - Available for superadmin only, top-level
    if (
      profile.role === "superadmin" &&
      availableSections.includes("benchmark")
    ) {
      menu.push({
        title: "Benchmark",
        url: "#",
        icon: Gauge,
        section: "benchmark",
      });
    }

    // Settings - Available for admin and superadmin, root level (bottom)
    if (
      (profile.role === "admin" || profile.role === "superadmin") &&
      availableSections.includes("settings")
    ) {
      menu.push({
        title: "Settings",
        url: "#",
        icon: Settings,
        section: "settings",
      });
    }

    // Apply search filter if search term exists
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const filteredMenu = menu
        .map((section) => {
          // Check if this is a root-level item (has section but no items)
          if (section.section && !section.items) {
            // Root-level item - check if it matches search
            const matchesSearch =
              section.title.toLowerCase().includes(searchLower) ||
              section.section.toLowerCase().includes(searchLower);
            return matchesSearch ? section : null;
          }

          // Section with sub-items - filter items
          const filteredItems =
            section.items?.filter(
              (item) =>
                item.title.toLowerCase().includes(searchLower) ||
                item.section?.toLowerCase().includes(searchLower)
            ) || [];

          // Also check if the section title itself matches
          const sectionMatches = section.title
            .toLowerCase()
            .includes(searchLower);

          // Return section if it has matching items or if section title matches
          if (filteredItems.length > 0 || sectionMatches) {
            return {
              ...section,
              items: filteredItems,
            };
          }

          return null;
        })
        .filter((section): section is NavSection => section !== null);

      return filteredMenu;
    }

    return menu;
  }, [profile, searchTerm, availableSections]);

  // Resolve the href for any menu item (for use with <Link>)
  const getItemHref = useCallback(
    (item: MenuItem): string => {
      if (item.url && item.url !== "#") {
        return item.url;
      }
      if (item.section) {
        return getSectionRoute(item.section, pathname);
      }
      return "#";
    },
    [pathname]
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
  const canEmulate =
    isAuthenticated &&
    profile &&
    profile.role &&
    ["instructional", "admin", "superadmin"].includes(profile.role);

  // Watch for profile changes and redirect if current page is not accessible
  // TEMPORARILY DISABLED: Let users manually navigate from access denied screen for debugging
  /*
  React.useEffect(() => {
    // Don't redirect if still loading or if we don't have a profile yet
    if (isLoading || !profile) {
      return;
    }

    // Only redirect if current page is not accessible
    if (!hasRouteAccess(pathname, profile.role)) {
      // Only redirect if we're not already on a redirect path
      const redirectPath = getRedirectPathForRole(profile.role);
      if (pathname !== redirectPath) {
        router.push(redirectPath);
      }
    }
  }, [profile, pathname, router, isLoading]);
  */

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

  // Show skeleton while profile is loading or while we don't have a complete profile yet
  const shouldShowSkeleton = isLoading || !profile;

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
