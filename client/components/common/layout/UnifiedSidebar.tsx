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
import { createFlexibleSectionChangeHandler } from "@/utils/navigation-utils";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Brain,
  ChevronRight,
  ChevronsUpDown,
  ClipboardList,
  Gauge,
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
import { useCallback, useMemo, useState } from "react";
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

  // Get sidebar context to close mobile sidebar on navigation
  const { isMobile, setOpenMobile } = useSidebar();

  // Use the profile context
  const {
    activeProfile,
    effectiveProfile,
    isLoading,
    availableSections,
    isFullEmulation,
    isAuthenticated,
  } = useProfile();

  // Build navigation menu based on role with search filtering
  const navMain = useMemo(() => {
    if (!effectiveProfile) return [];

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

    // Leaderboard - Available for all authorized users as root-level item
    if (availableSections.includes("leaderboard")) {
      menu.push({
        title: "Leaderboard",
        url: "#",
        icon: Trophy,
        section: "leaderboard",
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

    // Analytics - Available from instructional level and up
    if (
      ["instructional", "admin", "superadmin"].includes(
        effectiveProfile.role
      ) &&
      (availableSections.includes("dashboard") ||
        availableSections.includes("reports") ||
        availableSections.includes("activity") ||
        availableSections.includes("pricing"))
    ) {
      const analyticsItems: MenuItem[] = [];

      if (availableSections.includes("dashboard")) {
        analyticsItems.push({
          title: "Dashboard",
          url: "#",
          section: "dashboard",
        });
      }

      if (availableSections.includes("reports")) {
        analyticsItems.push({
          title: "Reports",
          url: "#",
          section: "reports",
        });
      }

      if (availableSections.includes("activity")) {
        analyticsItems.push({
          title: "Activity",
          url: "#",
          section: "activity",
        });
      }

      if (availableSections.includes("pricing")) {
        analyticsItems.push({
          title: "Pricing",
          url: "#",
          section: "pricing",
        });
      }

      if (analyticsItems.length > 0) {
        menu.push({
          title: "Analytics",
          url: "#",
          icon: PieChart,
          items: analyticsItems,
        });
      }
    }

    // Create - Available from instructor level and up
    if (
      availableSections.includes("personas") ||
      availableSections.includes("scenarios") ||
      availableSections.includes("simulations") ||
      availableSections.includes("cohorts")
    ) {
      const createItems: MenuItem[] = [];

      if (availableSections.includes("cohorts")) {
        createItems.push({
          title: "Cohorts",
          url: "#",
          section: "cohorts",
        });
      }

      if (availableSections.includes("simulations")) {
        createItems.push({
          title: "Simulations",
          url: "#",
          section: "simulations",
        });
      }

      if (availableSections.includes("scenarios")) {
        createItems.push({
          title: "Scenarios",
          url: "#",
          section: "scenarios",
        });
      }

      if (availableSections.includes("personas")) {
        createItems.push({
          title: "Personas",
          url: "#",
          section: "personas",
        });
      }

      if (createItems.length > 0) {
        menu.push({
          title: "Create",
          url: "#",
          icon: Sparkles,
          items: createItems,
        });
      }
    }

    // Management - Available from admin level and up
    if (
      availableSections.includes("staff") ||
      availableSections.includes("documents") ||
      availableSections.includes("parameters") ||
      availableSections.includes("fields")
    ) {
      const managementItems: MenuItem[] = [];

      menu.push({
        title: "Management",
        url: "#",
        icon: ClipboardList,
        items: managementItems,
      });

      if (availableSections.includes("staff")) {
        managementItems.push({
          title: "Staff",
          url: "#",
          section: "staff",
        });
      }

      if (availableSections.includes("documents")) {
        managementItems.push({
          title: "Documents",
          url: "#",
          section: "documents",
        });
      }

      if (availableSections.includes("parameters")) {
        managementItems.push({
          title: "Parameters",
          url: "#",
          section: "parameters",
        });
      }

      if (availableSections.includes("fields")) {
        managementItems.push({
          title: "Fields",
          url: "#",
          section: "fields",
        });
      }
    }

    // Engine - Available for admin and superadmin
    if (
      (effectiveProfile.role === "admin" ||
        effectiveProfile.role === "superadmin") &&
      (availableSections.includes("agents") ||
        availableSections.includes("models") ||
        availableSections.includes("rubrics") ||
        availableSections.includes("evals"))
    ) {
      const engineItems: MenuItem[] = [];

      menu.push({
        title: "Engine",
        url: "#",
        icon: Brain,
        items: engineItems,
      });

      if (availableSections.includes("agents")) {
        engineItems.push({
          title: "Agents",
          url: "#",
          section: "agents",
        });
      }

      if (availableSections.includes("models")) {
        engineItems.push({
          title: "Models",
          url: "#",
          section: "models",
        });
      }

      if (availableSections.includes("rubrics")) {
        engineItems.push({
          title: "Rubrics",
          url: "#",
          section: "rubrics",
        });
      }

      if (availableSections.includes("evals")) {
        engineItems.push({
          title: "Evals",
          url: "#",
          section: "evals",
        });
      }
    }

    // System - Available for superadmin only
    if (effectiveProfile.role === "superadmin") {
      const systemItems: MenuItem[] = [];

      if (availableSections.includes("departments")) {
        systemItems.push({
          title: "Departments",
          url: "#",
          section: "departments",
        });
      }

      if (availableSections.includes("keys")) {
        systemItems.push({
          title: "Keys",
          url: "#",
          section: "keys",
        });
      }

      if (availableSections.includes("providers")) {
        systemItems.push({
          title: "Providers",
          url: "#",
          section: "providers",
        });
      }

      if (availableSections.includes("auth")) {
        systemItems.push({
          title: "Auth",
          url: "#",
          section: "auth",
        });
      }

      // Only add System section if it has items
      if (systemItems.length > 0) {
        menu.push({
          title: "System",
          url: "#",
          icon: Server,
          items: systemItems,
        });
      }
    }

    // Health - Available for superadmin only, top-level
    if (
      effectiveProfile.role === "superadmin" &&
      availableSections.includes("health")
    ) {
      menu.push({
        title: "Health",
        url: "#",
        icon: Activity,
        section: "health",
      });
    }

    // Benchmark - Available for superadmin only, top-level
    if (
      effectiveProfile.role === "superadmin" &&
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
      (effectiveProfile.role === "admin" ||
        effectiveProfile.role === "superadmin") &&
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
  }, [effectiveProfile, searchTerm, availableSections]);

  const handleSectionChange = createFlexibleSectionChangeHandler(
    router,
    onSectionChange,
    pathname
  );

  // Wrapper function that closes mobile sidebar on section change
  const _handleSectionChangeWithClose = useCallback(
    (section: string) => {
      handleSectionChange(section);
      // Close mobile sidebar after navigation
      if (isMobile) {
        setOpenMobile(false);
      }
    },
    [handleSectionChange, isMobile, setOpenMobile]
  );

  const handleItemClick = useCallback(
    (item: MenuItem) => {
      // Prevent rapid navigation clicks that could cause freezing
      if (isNavigating) return;

      setIsNavigating(true);

      if (item.url && item.url !== "#") {
        // Navigate to the URL (for attempts)
        router.push(item.url);
        // Refresh to trigger server component re-render on route change
        router.refresh();
      } else if (item.section) {
        // Handle section changes (handleSectionChange already calls router.refresh())
        handleSectionChange(item.section);
      }

      // Close mobile sidebar after navigation
      if (isMobile) {
        setOpenMobile(false);
      }

      // Reset navigation state after a short delay
      setTimeout(() => setIsNavigating(false), 500);
    },
    [router, handleSectionChange, isNavigating, isMobile, setOpenMobile]
  );

  // Handle exit emulation
  const handleExitEmulation = useCallback(async () => {
    if (!activeProfile?.id) return;

    try {
      const result = await switchEffectiveProfile({
        targetProfileId: activeProfile.id,
        fullEmulation: false,
        emulationTTL: null,
      });

      if (!result.ok) {
        toast.error(result.reason || "Failed to exit emulation");
        return;
      }

      toast.success("Emulation exited successfully");
      // Session updated server-side, refresh to pick up changes
      router.refresh();
    } catch {
      toast.error("Failed to exit emulation");
    }
  }, [activeProfile?.id, switchEffectiveProfile, router]);

  // Check if currently emulating
  const isEmulating =
    activeProfile &&
    effectiveProfile &&
    activeProfile.id !== effectiveProfile.id;

  // Check if user can emulate (instructional and higher, and must be authenticated)
  // Guest/default account users can't emulate even if they have the right role
  const canEmulate =
    isAuthenticated &&
    activeProfile &&
    ["instructional", "admin", "superadmin"].includes(activeProfile.role);

  // Watch for profile changes and redirect if current page is not accessible
  // TEMPORARILY DISABLED: Let users manually navigate from access denied screen for debugging
  /*
  React.useEffect(() => {
    // Don't redirect if still loading or if we don't have a profile yet
    if (isLoading || !effectiveProfile) {
      return;
    }

    // Only redirect if current page is not accessible
    if (!hasRouteAccess(pathname, effectiveProfile.role)) {
      // Only redirect if we're not already on a redirect path
      const redirectPath = getRedirectPathForRole(effectiveProfile.role);
      if (pathname !== redirectPath) {
        router.push(redirectPath);
      }
    }
  }, [effectiveProfile, pathname, router, isLoading]);
  */

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
  const shouldShowSkeleton = isLoading || !effectiveProfile;

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
                        {!effectiveProfile
                          ? "GU"
                          : getInitials(
                              effectiveProfile?.firstName +
                                " " +
                                effectiveProfile?.lastName
                            )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-0.5 leading-none text-left">
                      <span className="font-medium truncate">{`${effectiveProfile?.firstName || "Guest"} ${effectiveProfile?.lastName || "User"}`}</span>
                      {/* Capitalize the role for display */}
                      <span className="text-xs capitalize">
                        {effectiveProfile?.role || "guest"}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  align="start"
                >
                  {/* Emulate or Exit Emulation - Hidden in full emulation mode */}
                  {!isFullEmulation && (
                    <>
                      {isEmulating ? (
                        <>
                          <DropdownMenuItem onClick={handleExitEmulation}>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Exit Emulation
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      ) : canEmulate ? (
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
                    </>
                  )}
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
                    <div
                      onClick={() =>
                        handleItemClick({
                          title: item.title,
                          url: item.url,
                          section: item.section!,
                        })
                      }
                      className={`flex items-center gap-2 px-2 py-1.5 ${activeSection === item.section ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.title}
                    </div>
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
                              isActive={activeSection === subItem.section}
                              onClick={() => handleItemClick(subItem)}
                              className={`${subItem.isSubItem ? "pl-8 text-sm" : "pl-8"}`}
                            >
                              {subItem.title}
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
