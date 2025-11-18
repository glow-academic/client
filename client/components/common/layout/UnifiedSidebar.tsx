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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { createFlexibleSectionChangeHandler } from "@/utils/navigation-utils";
import {
  AlertCircle,
  Brain,
  ChartBar,
  ChevronRight,
  ChevronsUpDown,
  Home,
  LogOut,
  Search,
  Settings,
  Sparkles,
  User,
  UserCogIcon,
  Users,
} from "lucide-react";
import { signOut } from "next-auth/react";
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

  // Get sidebar context to close mobile sidebar on navigation
  const { isMobile, setOpenMobile } = useSidebar();

  // Use the profile context
  const {
    activeProfile,
    effectiveProfile,
    isLoading,
    cohorts,
    availableSections,
    isFullEmulation,
  } = useProfile();

  const getCohortSubItems = React.useMemo(() => {
    if (!cohorts || !effectiveProfile) return [];

    return cohorts.map((c: { id: string; title: string }) => ({
      title: c.title,
      url: `/cohorts/c/${c.id}`,
      section: `cohort-${c.id}`,
      isSubItem: true,
    }));
  }, [cohorts, effectiveProfile]);

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

    // Practice - all users
    if (availableSections.includes("practice")) {
      menu.push({
        title: "Practice",
        url: "#",
        icon: Brain,
        section: "practice",
      });
    }

    // Cohorts sections based on role
    if (availableSections.includes("cohorts")) {
      if (["ta"].includes(effectiveProfile.role)) {
        // TA/Instructor view - collapsible with sub-items
        menu.push({
          title: "Cohorts",
          url: "#",
          icon: Users,
          items: [...getCohortSubItems],
        });
      } else {
        // Staff/Admin view - single items, no sub-items, no "new"
        menu.push({
          title: "Cohorts",
          url: "#",
          icon: Users,
          section: "cohorts",
        });
      }
    }

    // Analytics - Available from instructor level and up
    if (
      availableSections.includes("dashboard") ||
      availableSections.includes("reports") ||
      availableSections.includes("leaderboard") ||
      availableSections.includes("pricing")
    ) {
      const analyticsItems: MenuItem[] = [
        {
          title: "Dashboard",
          url: "#",
          section: "dashboard",
        },
        {
          title: "Reports",
          url: "#",
          section: "reports",
        },
        {
          title: "Pricing",
          url: "#",
          section: "pricing",
        },
        {
          title: "Leaderboard",
          url: "#",
          section: "leaderboard",
        },
      ];

      menu.push({
        title: "Analytics",
        url: "#",
        icon: ChartBar,
        items: analyticsItems,
      });
    }

    // Create - Available from instructor level and up
    if (
      availableSections.includes("personas") ||
      availableSections.includes("documents") ||
      availableSections.includes("scenarios") ||
      availableSections.includes("simulations")
    ) {
      menu.push({
        title: "Create",
        url: "#",
        icon: Sparkles,
        items: [
          {
            title: "Simulations",
            url: "#",
            section: "simulations",
          },
          {
            title: "Scenarios",
            url: "#",
            section: "scenarios",
          },
          {
            title: "Personas",
            url: "#",
            section: "personas",
          },
          {
            title: "Documents",
            url: "#",
            section: "documents",
          },
        ],
      });
    }

    // Management - Available from admin level only
    if (
      availableSections.includes("departments") ||
      availableSections.includes("parameters") ||
      availableSections.includes("rubrics") ||
      availableSections.includes("agents")
    ) {
      const managementItems: MenuItem[] = [];

      menu.push({
        title: "Management",
        url: "#",
        icon: UserCogIcon,
        items: managementItems,
      });

      if (availableSections.includes("departments")) {
        managementItems.push({
          title: "Departments",
          url: "#",
          section: "departments",
        });
      }

      if (availableSections.includes("agents")) {
        managementItems.push({
          title: "Agents",
          url: "#",
          section: "agents",
        });
      }

      if (availableSections.includes("rubrics")) {
        managementItems.push({
          title: "Rubrics",
          url: "#",
          section: "rubrics",
        });
      }

      if (availableSections.includes("parameters")) {
        managementItems.push({
          title: "Parameters",
          url: "#",
          section: "parameters",
        });
      }
    }

    // System  - Available from admin level and up
    if (
      availableSections.includes("providers") ||
      availableSections.includes("staff") ||
      availableSections.includes("feedback") ||
      availableSections.includes("logs")
    ) {
      const systemItems: MenuItem[] = [];

      menu.push({
        title: "System",
        url: "#",
        icon: Settings,
        items: systemItems,
      });

      if (availableSections.includes("staff")) {
        systemItems.push({
          title: "Staff",
          url: "#",
          section: "staff",
        });
      }

      if (availableSections.includes("providers")) {
        systemItems.push({
          title: "Providers",
          url: "#",
          section: "providers",
        });
      }

      // Feedback - moved from management
      if (availableSections.includes("feedback")) {
        systemItems.push({
          title: "Feedback",
          url: "#",
          section: "feedback",
        });
      }

      // Logs - available for admin
      if (availableSections.includes("logs")) {
        systemItems.push({
          title: "Logs",
          url: "#",
          section: "logs",
        });
      }
    }

    // Apply search filter if search term exists
    if (searchTerm.trim()) {
      const filteredMenu = menu
        .map((section) => ({
          ...section,
          items:
            section.items?.filter(
              (item) =>
                item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.section?.toLowerCase().includes(searchTerm.toLowerCase())
            ) || [],
        }))
        .filter((section) => section.items.length > 0);

      return filteredMenu;
    }

    return menu;
  }, [effectiveProfile, searchTerm, getCohortSubItems, availableSections]);

  const handleSectionChange = createFlexibleSectionChangeHandler(
    router,
    onSectionChange,
    pathname
  );

  // Wrapper function that closes mobile sidebar on section change
  const handleSectionChangeWithClose = useCallback(
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
      } else if (item.section) {
        // Handle section changes
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
  const isEmulating = activeProfile && effectiveProfile && activeProfile.id !== effectiveProfile.id;

  // Check if user can emulate (instructional and higher)
  const canEmulate = activeProfile && ["instructional", "admin", "superadmin"].includes(activeProfile.role);

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
    const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";
    if (activeProfile?.role === "guest") {
      // Navigate to login page for guests or when no user
      router.push("/");
      return;
    }

    // Handle logout for logged-in users
    setIsLoggingOut(true);

    toast.promise(
      async () => {
        try {
          await signOut({ redirectTo: `${appPrefix}/` });
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
                  {/* Profile - Hidden from guests */}
                  {activeProfile && activeProfile.role !== "guest" && (
                    <>
                      <DropdownMenuItem
                        onClick={() => handleSectionChangeWithClose("profile")}
                      >
                        <User className="h-4 w-4 mr-2" />
                        Profile
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
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
                    {isLoggingOut
                      ? "Logging out..."
                      : activeProfile?.role === "guest" || !activeProfile
                        ? "Log in"
                        : "Logout"}
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
                  <div className="relative group">
                    <div className="relative border border-blue-500 dark:border-purple-600 rounded-lg px-4 py-2.5 transition-all duration-200 bg-transparent hover:bg-blue-50 dark:hover:bg-purple-950 text-blue-700 dark:text-purple-200 shadow-none hover:shadow-md">
                      <div className="flex items-center justify-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        <span className="font-medium text-sm">Report Problem</span>
                      </div>
                    </div>
                  </div>
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
