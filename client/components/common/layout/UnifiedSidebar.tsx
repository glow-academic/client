/**
 * UnifiedSidebar.tsx
 * Used to display the sidebar for the application
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
import ReportProblem from "@/components/common/layout/ReportProblem";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { useProfile } from "@/contexts/profile-context";
import { Class, Cohort } from "@/types";
import { getSimulatableProfiles } from "@/utils/auth/get-simulatable-profiles";
import { logError } from "@/utils/logger";
import { createFlexibleSectionChangeHandler } from "@/utils/navigation-utils";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllDepartments } from "@/utils/queries/departments/get-all-departments";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
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
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import * as React from "react";
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

export function UnifiedSidebar({
  activeSection,
  onSectionChange,
  ...props
}: UnifiedSidebarProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [profileSearchTerm, setProfileSearchTerm] = React.useState("");

  // Create a ref for the profile search input
  const profileSearchInputRef = React.useRef<HTMLInputElement>(null);

  // Use the profile context
  const { activeProfile, effectiveProfile, setSimulatedProfile } = useProfile();

  // Get simulatable profiles for the dropdown
  const { data: simulatableProfiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["simulatableProfiles", activeProfile?.id],
    queryFn: () => getSimulatableProfiles(),
    enabled:
      !!activeProfile &&
      ["superadmin", "admin", "instructional"].includes(activeProfile.role),
  });

  // Create the final profile list for the dropdown, organized by priority
  const profileOptions = React.useMemo(() => {
    if (!activeProfile) return [];

    const options = [];

    // 1. Start with the user's own profile (actualProfile)
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

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => getAllDepartments(),
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

  const { data: cohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const getClassSubItems = React.useMemo(() => {
    if (!classes) return [];

    let profileClasses: Class[] = [];

    switch (effectiveProfile.role) {
      case "superadmin":
      case "admin":
        profileClasses = classes;
        break;
      case "instructional":
        if (effectiveProfile.defaultProfile) {
          profileClasses = classes;
          break;
        }
        profileClasses = classes.filter((classData: Class) =>
          departments?.some((d) => d.id === classData.departmentId)
        );
        break;
      case "instructor":
      case "ta":
        if (effectiveProfile.defaultProfile) {
          profileClasses = classes;
          break;
        }
        profileClasses = classes.filter((classData: Class) =>
          classData?.profileIds?.includes(effectiveProfile?.id || "")
        );
        break;
      default:
        return [];
    }

    return profileClasses.map((c: { id: string; classCode: string, departmentId: string }) => {
      const department = departments?.find((d) => d.id === c.departmentId);
      return {
      title: `${department?.departmentCode} ${c.classCode}`,
      url: `/classes/c/${c.id}`,
      section: `class-${c.id}`,
      isSubItem: true,
    };
  });
  }, [
    classes,
    departments,
    effectiveProfile.role,
    effectiveProfile?.id,
    effectiveProfile.defaultProfile,
  ]);

  const getCohortSubItems = React.useMemo(() => {
    if (!cohorts) return [];

    let profileCohorts: Cohort[] = [];

    switch (effectiveProfile.role) {
      case "superadmin":
      case "admin":
        profileCohorts = cohorts;
        break;
      case "instructional":
        if (effectiveProfile.defaultProfile) {
          profileCohorts = cohorts;
          break;
        }
        profileCohorts = cohorts.filter((cohortData: Cohort) =>
          departments?.some((d) => d.id === cohortData.departmentId)
        );
        break;
      case "instructor":
      case "ta":
        if (effectiveProfile.defaultProfile) {
          profileCohorts = cohorts;
          break;
        }
        profileCohorts = cohorts.filter((cohortData: Cohort) =>
          cohortData?.profileIds?.includes(effectiveProfile?.id || "")
        );
        break;
      default:
        return [];
    }

    return profileCohorts.map((c: { id: string; title: string }) => ({
      title: c.title,
      url: `/cohorts/c/${c.id}`,
      section: `cohort-${c.id}`,
      isSubItem: true,
    }));
  }, [
    cohorts,
    departments,
    effectiveProfile.role,
    effectiveProfile?.id,
    effectiveProfile.defaultProfile,
  ]);

  // Build navigation menu based on role with search filtering
  const navMain = React.useMemo(() => {
    const menu: NavSection[] = [];

    // Home - Only for TAs and guests
    if (effectiveProfile.role === "ta" || effectiveProfile.role === "guest") {
      menu.push({
        title: "Home",
        url: "#",
        icon: Home,
        section: "home",
      });
    }

    // Analytics - Available from instructor level and up
    if (
      ["instructional", "admin", "superadmin"].includes(
        effectiveProfile.role
      )
    ) {
      menu.push({
        title: "Analytics",
        url: "#",
        icon: ChartBar,
        items: [
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
            title: "Progress",
            url: "#",
            section: "progress",
          },
        ],
      });
    }

    // Classes and Cohorts sections based on role
    if (["ta", "instructor"].includes(effectiveProfile.role)) {
      // TA/Instructor view - collapsible with sub-items
      menu.push({
        title: "Cohorts",
        url: "#",
        icon: Users,
        items: [
          ...getCohortSubItems,
          ...(effectiveProfile.role === "instructor"
            ? [{ title: "New", url: "/cohorts/new", isSubItem: true }]
            : []),
        ],
      });

      menu.push({
        title: "Classes",
        url: "#",
        icon: BookOpen,
        items: [
          ...getClassSubItems,
          ...(effectiveProfile.role === "instructor"
            ? [{ title: "New", url: "/classes/new", isSubItem: true }]
            : []),
        ],
      });
    } else if (
      ["instructional", "admin", "superadmin"].includes(effectiveProfile.role)
    ) {
      // Staff/Admin view - single items, no sub-items, no "new"

      menu.push({
        title: "Cohorts",
        url: "#",
        icon: Users,
        section: "cohorts",
      });

      menu.push({
        title: "Classes",
        url: "#",
        icon: BookOpen,
        section: "classes",
      });
    }

    // Create - Available from instructor level and up
    if (
      ["instructor", "instructional", "admin", "superadmin"].includes(
        effectiveProfile.role
      )
    ) {
      menu.push({
        title: "Create",
        url: "#",
        icon: Sparkles,
        items: [
          {
            title: "Agents",
            url: "#",
            section: "agents",
          },
          {
            title: "Rubrics",
            url: "#",
            section: "rubrics",
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
    if (["admin", "superadmin"].includes(effectiveProfile.role)) {
      const managementItems: MenuItem[] = [];

      menu.push({
        title: "Management",
        url: "#",
        icon: UserCogIcon,
        items: managementItems,
      });

      managementItems.push({
        title: "Staff",
        url: "#",
        section: "staff",
      });

      managementItems.push({
        title: "Activity",
        url: "#",
        section: "activity",
      });

      managementItems.push({
        title: "Feedback",
        url: "#",
        section: "feedback",
      });

      managementItems.push({
        title: "Departments",
        url: "#",
        section: "departments",
      });
    }

    // System  - Available from superadmin level only
    if (["superadmin"].includes(effectiveProfile.role)) {
      const systemItems: MenuItem[] = [];

      menu.push({
        title: "System",
        url: "#",
        icon: Settings,
        items: systemItems,
      });

      systemItems.push({
        title: "Agents",
        url: "#",
        section: "system-agents",
      });

      // Providers - available for admin
      systemItems.push({
        title: "Providers",
        url: "#",
        section: "providers",
      });

      // Logs - available for admin
      systemItems.push({
        title: "Logs",
        url: "#",
        section: "logs",
      });

      // Health - available for admin
      systemItems.push({
        title: "Health",
        url: "#",
        section: "health",
      });
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
  }, [effectiveProfile.role, searchTerm, getClassSubItems, getCohortSubItems]);

  const handleSectionChange = createFlexibleSectionChangeHandler(
    router,
    onSectionChange
  );

  const handleItemClick = (item: MenuItem) => {
    if (item.url && item.url !== "#") {
      // Navigate to the URL (for attempts)
      router.push(item.url);
    } else if (item.section) {
      // Handle section changes
      handleSectionChange(item.section);
    }
  };

  const handleProfileSelect = (profileId: string) => {
    // If the user selects their own profile, clear the simulation
    if (profileId === activeProfile?.id) {
      setSimulatedProfile(null, true); // `null` resets to activeProfile
    } else {
      // Otherwise, simulate the selected profile
      setSimulatedProfile(profileId, true);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const handleLoginOrLogout = async () => {
    if (effectiveProfile.role === "guest" || !activeProfile) {
      // Navigate to login page for guests or when no user
      router.push("/");
      return;
    }

    // Handle logout for logged-in users
    setIsLoggingOut(true);

    toast.promise(
      async () => {
        try {
          // Clear guest mode if it exists
          localStorage.removeItem("guestAttemptIds");
          localStorage.removeItem("simulatedRole");
          localStorage.removeItem("guestMode");
          await signOut({ redirectTo: "/" });
          return "Logged out successfully";
        } catch (error) {
          logError("Error logging out:", error);
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

  return (
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
                  <Avatar className="h-8 w-8">
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

                {isLoadingProfiles ? (
                  <DropdownMenuItem disabled>
                    Loading profiles...
                  </DropdownMenuItem>
                ) : (
                  <div className="max-h-60 overflow-y-auto">
                    {profileOptions.map((profile) => (
                      <DropdownMenuItem
                        key={profile.id}
                        onSelect={() => handleProfileSelect(profile.id)}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 text-xs">
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
                )}
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
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {effectiveProfile.role === "guest" || !activeProfile
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
                      {effectiveProfile.role === "guest" || !activeProfile
                        ? "Guest User"
                        : activeProfile?.firstName +
                          " " +
                          activeProfile?.lastName}
                    </span>
                    <span className="truncate text-xs">
                      {effectiveProfile.role === "guest" || !activeProfile
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
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {effectiveProfile.role === "guest" || !activeProfile
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
                        {effectiveProfile.role === "guest" || !activeProfile
                          ? "Guest User"
                          : activeProfile?.firstName +
                            " " +
                            activeProfile?.lastName}
                      </span>
                      <span className="truncate text-xs">
                        {effectiveProfile.role === "guest" || !activeProfile
                          ? "Not logged in"
                          : `${activeProfile?.alias}@${process.env["NEXT_PUBLIC_CAMPUS_EMAIL"]}`}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {activeProfile && effectiveProfile.role !== "guest" && (
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
                    : effectiveProfile.role === "guest" || !activeProfile
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
  );
}
