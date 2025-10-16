/**
 * UnifiedSidebar.tsx
 * Used to display the sidebar for the application
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
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
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useDepartments } from "@/contexts/departments-context";
import { useProfile } from "@/contexts/profile-context";
import { createFlexibleSectionChangeHandler } from "@/utils/navigation-utils";
import {
  Brain,
  ChartBar,
  Check,
  ChevronRight,
  ChevronsUpDown,
  Home,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  Sparkles,
  User,
  UserCogIcon,
  Users,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

export interface UnifiedSidebarProps
  extends React.ComponentProps<typeof Sidebar> {
  activeSection: string;
  onSectionChange?: (section: string) => void;
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

// Skeleton component for the sidebar
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

export function UnifiedSidebar({
  activeSection,
  onSectionChange,
  ...props
}: UnifiedSidebarProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [profileSearchTerm, setProfileSearchTerm] = React.useState("");
  const [isEmulateDialogOpen, setIsEmulateDialogOpen] = useState(false);

  // Create a ref for the profile search input
  const profileSearchInputRef = React.useRef<HTMLInputElement>(null);

  // Use the profile context
  const {
    activeProfile,
    effectiveProfile,
    isLoading,
    cohorts,
    simulatableProfiles,
    availableSections,
  } = useProfile();
  const { effectiveDepartmentIds } = useDepartments();
  const { update } = useSession();

  const getCohortSubItems = React.useMemo(() => {
    if (!cohorts || !effectiveProfile) return [];

    return cohorts.map((c: { id: string; title: string }) => ({
      title: c.title,
      url: `/cohorts/c/${c.id}`,
      section: `cohort-${c.id}`,
      isSubItem: true,
    }));
  }, [cohorts, effectiveProfile]);

  // Create the final profile list for the dropdown, organized by priority
  const profileOptions = React.useMemo(() => {
    if (!activeProfile) return [];

    const options = [];

    // 1. Start with the user's own profile (activeProfile)
    options.push(activeProfile);

    // 2. Add profiles with defaultProfile = true
    if (simulatableProfiles) {
      const defaultProfiles = simulatableProfiles.filter(
        (profile) => profile.defaultProfile
      );
      options.push(...defaultProfiles);
    }

    // 3. Add the rest of the simulatable profiles
    if (simulatableProfiles) {
      const regularProfiles = simulatableProfiles.filter(
        (profile) => !profile.defaultProfile
      );
      options.push(...regularProfiles);
    }

    // Apply search filter if profileSearchTerm exists
    if (profileSearchTerm.trim()) {
      return options.filter(
        (profile) =>
          `${profile.firstName} ${profile.lastName}`
            .toLowerCase()
            .includes(profileSearchTerm.toLowerCase()) ||
          profile.role
            .toLowerCase()
            .includes(profileSearchTerm.toLowerCase()) ||
          profile.alias?.toLowerCase().includes(profileSearchTerm.toLowerCase())
      );
    }

    return options;
  }, [activeProfile, simulatableProfiles, profileSearchTerm]);

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
          title: "Leaderboard",
          url: "#",
          section: "leaderboard",
        },
      ];

      if (availableSections.includes("pricing")) {
        analyticsItems.push({
          title: "Pricing",
          url: "#",
          section: "pricing",
        });
      }

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
            title: "Personas",
            url: "#",
            section: "personas",
          },
          {
            title: "Documents",
            url: "#",
            section: "documents",
          },
          {
            title: "Scenarios",
            url: "#",
            section: "scenarios",
          },
          {
            title: "Simulations",
            url: "#",
            section: "simulations",
          },
        ],
      });
    }

    // Management - Available from admin level only
    if (
      availableSections.includes("staff") ||
      availableSections.includes("parameters") ||
      availableSections.includes("rubrics") ||
      availableSections.includes("departments")
    ) {
      const managementItems: MenuItem[] = [];

      menu.push({
        title: "Management",
        url: "#",
        icon: UserCogIcon,
        items: managementItems,
      });

      if (availableSections.includes("staff")) {
        managementItems.push({
          title: "Staff",
          url: "#",
          section: "staff",
        });
      }

      if (availableSections.includes("parameters")) {
        managementItems.push({
          title: "Parameters",
          url: "#",
          section: "parameters",
        });
      }

      if (availableSections.includes("rubrics")) {
        managementItems.push({
          title: "Rubrics",
          url: "#",
          section: "rubrics",
        });
      }

      if (availableSections.includes("departments")) {
        managementItems.push({
          title: "Departments",
          url: "#",
          section: "departments",
        });
      }
    }

    // System  - Available from admin level and up
    if (
      availableSections.includes("providers") ||
      availableSections.includes("agents") ||
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

      if (availableSections.includes("providers")) {
        systemItems.push({
          title: "Providers",
          url: "#",
          section: "providers",
        });
      }

      if (availableSections.includes("agents")) {
        systemItems.push({
          title: "Agents",
          url: "#",
          section: "agents",
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

      // Reset navigation state after a short delay
      setTimeout(() => setIsNavigating(false), 500);
    },
    [router, handleSectionChange, isNavigating]
  );

  const handleProfileSelect = async (profileId: string) => {
    const isSelf = profileId === activeProfile?.id;

    try {
      if (isSelf) {
        // revert to self (no need to authorize)
        await update({
          effectiveProfileId: activeProfile!.id,
          emulationTTL: null,
        });
      } else {
        // 1) server permission check using v2 auth endpoint
        const r = await fetch("/api/v2/auth/authorize-emulation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            requesterProfileId: activeProfile!.id,
            targetProfileId: profileId,
            departmentIds: effectiveDepartmentIds,
          }),
        });

        if (!r.ok) {
          toast.error("Failed to authorize emulation");
          return;
        }

        const result = await r.json().catch(() => ({ allowed: false }));
        if (!result.allowed) {
          toast.error(result.reason || "Emulation not allowed");
          return;
        }

        // 2) write to NextAuth session (authoritative) - this is half emulation
        await update({
          effectiveProfileId: profileId,
          // optional TTL: 2 hours
          emulationTTL: Date.now() + 120 * 60 * 1000,
          fullEmulation: false, // This is half emulation, not full
        });
      }

      // Reload so server-rendered pages pick up the new session
      window.location.reload();
    } catch (error) {
      log.error("profile.switch.failed", {
        message: "Failed to switch profile",
        error,
        context: {
          component: "UnifiedSidebar",
          function: "handleProfileSelect",
        },
      });
      toast.error("Failed to switch profile");
    }
  };

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
          log.error("auth.logout.failed", {
            message: "Error logging out",
            error,
            context: {
              component: "UnifiedSidebar",
              function: "handleLoginOrLogout",
            },
          });
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
          {/* Profile Switcher */}
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu
                onOpenChange={(open) => {
                  if (open) {
                    // Focus the search input when the dropdown opens
                    setTimeout(() => {
                      profileSearchInputRef.current?.focus();
                    }, 0);
                  }
                }}
              >
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
                        {getInitials(
                          `${effectiveProfile.firstName} ${effectiveProfile.lastName}`
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-0.5 leading-none text-left">
                      <span className="font-medium truncate">{`${effectiveProfile.firstName} ${effectiveProfile.lastName}`}</span>
                      {/* Capitalize the role for display */}
                      <span className="text-xs capitalize">
                        {effectiveProfile.role}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-64"
                  align="start"
                >
                  {/* Search input for profiles */}
                  <div className="px-2 py-1.5">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <input
                        ref={profileSearchInputRef}
                        type="text"
                        placeholder="Search profiles..."
                        value={profileSearchTerm}
                        onChange={(e) => setProfileSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="w-full pl-7 pr-2 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      />
                    </div>
                  </div>

                  <DropdownMenuSeparator />

                  <div className="max-h-60 overflow-y-auto">
                    {profileOptions.map((profile) => (
                      <DropdownMenuItem
                        key={profile.id}
                        onSelect={() => handleProfileSelect(profile.id)}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar
                            className="h-6 w-6 text-xs outline outline-muted-foreground"
                            style={{
                              outlineWidth: "1px",
                              outlineStyle: "solid",
                            }}
                          >
                            <AvatarFallback>
                              {getInitials(
                                `${profile.firstName} ${profile.lastName}`
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col leading-tight">
                            <span>{`${profile.firstName} ${profile.lastName}`}</span>
                            <span className="text-xs capitalize text-muted-foreground">
                              {profile.role}
                            </span>
                          </div>
                        </div>
                        {profile.id === effectiveProfile.id && (
                          <Check className="ml-auto size-4" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </div>
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

        {/* User Profile in Footer */}
        <SidebarFooter>
          <SidebarMenu>
            {/* Report Problem Button - Enhanced with bubble styling */}
            <SidebarMenuItem>
              <div className="px-2 pb-2">
                <ReportProblem>
                  <div className="relative group">
                    <div className="relative border border-blue-500 dark:border-purple-600 rounded-lg px-4 py-2.5 transition-all duration-200 bg-transparent hover:bg-blue-50 dark:hover:bg-purple-950 text-blue-700 dark:text-purple-200 shadow-none hover:shadow-md">
                      <div className="flex items-center justify-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        <span className="font-medium text-sm">Feedback</span>
                      </div>
                    </div>
                  </div>
                </ReportProblem>
              </div>
            </SidebarMenuItem>

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
                        {!activeProfile
                          ? "GU"
                          : getInitials(
                              activeProfile?.firstName +
                                " " +
                                activeProfile?.lastName
                            )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {!activeProfile
                          ? "Guest User"
                          : activeProfile?.firstName +
                            " " +
                            activeProfile?.lastName}
                      </span>
                      <span className="truncate text-xs">
                        {!activeProfile
                          ? "Not logged in"
                          : `${activeProfile?.alias}@${process.env["NEXT_PUBLIC_CAMPUS_EMAIL"]}`}
                      </span>
                    </div>
                    <ChevronRight className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="bottom"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar
                        className="h-8 w-8 outline outline-muted-foreground"
                        style={{ outlineWidth: "1px", outlineStyle: "solid" }}
                      >
                        <AvatarFallback>
                          {!activeProfile
                            ? "GU"
                            : getInitials(
                                activeProfile?.firstName +
                                  " " +
                                  activeProfile?.lastName
                              )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">
                          {!activeProfile
                            ? "Guest User"
                            : activeProfile?.firstName +
                              " " +
                              activeProfile?.lastName}
                        </span>
                        <span className="truncate text-xs">
                          {!activeProfile
                            ? "Not logged in"
                            : `${activeProfile?.alias}@${process.env["NEXT_PUBLIC_CAMPUS_EMAIL"]}`}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {activeProfile &&
                    activeProfile.role === "superadmin" &&
                    effectiveProfile.id !== activeProfile.id && (
                      <>
                        <DropdownMenuItem
                          onClick={() => setIsEmulateDialogOpen(true)}
                          className="group text-white hover:text-white focus:text-white data-[highlighted]:text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                        >
                          <Sparkles className="h-4 w-4 mr-2 text-white group-hover:text-white/90" />
                          Emulate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                  {activeProfile && (
                    <>
                      <DropdownMenuItem
                        onClick={() => handleSectionChange("profile")}
                      >
                        <User className="h-4 w-4 mr-2" />
                        Profile
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
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
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* Emulate Confirmation Dialog */}
      <Dialog open={isEmulateDialogOpen} onOpenChange={setIsEmulateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enable Emulation</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              You are about to enable emulation. You will be embodied as{" "}
              {effectiveProfile?.firstName} {effectiveProfile?.lastName} and may
              take simulations on their behalf.
            </p>
            <p className="font-medium">
              The only way to exit emulation is to log out.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsEmulateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="group text-white hover:text-white focus:text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              onClick={async () => {
                try {
                  // Use the same server authorization flow as profile switching
                  const r = await fetch("/api/emulate/authorize", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                      targetProfileId: effectiveProfile.id,
                      departmentIds: effectiveDepartmentIds,
                    }),
                  });
                  if (!r.ok) {
                    const msg =
                      (await r.json().catch(() => ({})))?.error || "Forbidden";
                    toast.error(msg);
                    return;
                  }

                  // Update the session to enable full emulation mode
                  await update({
                    effectiveProfileId: effectiveProfile.id,
                    emulationTTL: Date.now() + 120 * 60 * 1000, // 2 hours
                    fullEmulation: true, // This enables full emulation mode
                  });

                  // Reload to pick up the new session
                  window.location.reload();
                } catch (error) {
                  log.error("emulation.enable.failed", {
                    message: "Failed to enable emulation",
                    error,
                    context: {
                      component: "UnifiedSidebar",
                      function: "emulateButton",
                    },
                  });
                  toast.error("Failed to enable emulation");
                }
                setIsEmulateDialogOpen(false);
              }}
            >
              <span className="inline-flex items-center">
                <Sparkles className="h-4 w-4 mr-2 text-white group-hover:text-white/90" />
                Enable Emulation
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
