/**
 * unified-sidebar.tsx
 * Used to display the sidebar for the application
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
import * as React from "react";
import {
  ChevronRight,
  Home,
  BookOpen,
  FileText,
  GraduationCap,
  Settings,
  Search,
  User,
  LogOut,
  Check,
  ChevronsUpDown,
  ChartBar,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import { createFlexibleSectionChangeHandler } from "@/utils/navigation-utils";
import { useRole } from "@/contexts/role-context";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarInput,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { useSession } from "next-auth/react";
import { getAllUsers } from "@/utils/queries/users/get-all-users";
import { getUserByEmail } from "@/utils/user/get-user-by-email";

type ProfileRole = "admin" | "instructional" | "instructor" | "ta";

interface UnifiedSidebarProps extends React.ComponentProps<typeof Sidebar> {
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

// Helper function to get hierarchical modes based on user role
const getAvailableModes = (ProfileRole: ProfileRole) => {
  const roleLabels = {
    admin: "Administrator",
    instructional: "Instructional Staff",
    instructor: "Instructor",
    ta: "Teaching Assistant",
  };

  const roleHierarchy = ["admin", "instructional", "instructor", "ta"];
  const userIndex = roleHierarchy.indexOf(ProfileRole);

  if (userIndex === -1) return [];

  const availableRoles = roleHierarchy.slice(userIndex);
  const modes = availableRoles.map((role) => ({
    key: role,
    label: roleLabels[role as ProfileRole],
  }));

  // All roles can access guest mode
  modes.push({ key: "guest", label: "Guest Mode" });

  return modes;
};

export function UnifiedSidebar({
  activeSection,
  onSectionChange,
  ...props
}: UnifiedSidebarProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  // Use the role context instead of local state
  const { effectiveRole, setRole } = useRole();
  const session = useSession();
  const userEmail = session.data?.user?.email;

  const { data: user } = useQuery({
    queryKey: ["user", userEmail],
    queryFn: () => getUserByEmail(userEmail!),
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", userEmail],
    queryFn: () => getProfilesByUser(user!.id!),
    select: (data) => data[0],
    enabled: !!user,
  });

  // Fetch classes for dynamic menu
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

  // Get available modes based on user role
  const availableModes = React.useMemo(() => {
    if (!profile?.role) return [{ key: "guest", label: "Guest Mode" }];
    return getAvailableModes(profile.role);
  }, [profile?.role]);

  // Get current mode label
  const currentModeLabel = React.useMemo(() => {
    const mode = availableModes.find((m) => m.key === effectiveRole);
    return mode?.label || "Guest Mode";
  }, [availableModes, effectiveRole]);

  // Filter classes based on user role
  const availableClasses = React.useMemo(() => {
    if (!profile || !classes || effectiveRole === "guest") return [];

    switch (effectiveRole) {
      case "admin":
      case "instructional":
        return classes; // Full access
      case "instructor":
        // Only classes the user is assigned to
        return classes.filter((cls: ClassData) =>
          profile.classIds?.includes(cls.id),
        );
      case "ta":
        return []; // No class access for TAs
      default:
        return [];
    }
  }, [classes, profile, effectiveRole]);

  // Build navigation menu based on role with search filtering
  const navMain = React.useMemo(() => {
    const menu: NavSection[] = [];

    // Home - Only for TAs and guests
    if (effectiveRole === "ta" || effectiveRole === "guest") {
      menu.push({
        title: "Home",
        url: "#",
        icon: Home,
        section: "home",
      });
    }

    // Growth - Only for TAs
    if (effectiveRole === "ta") {
      menu.push({
        title: "Growth",
        url: "#",
        icon: TrendingUp,
        section: "growth",
      });
    }

    // Analytics - Available from instructor level and up
    if (["instructor", "instructional", "admin"].includes(effectiveRole)) {
      menu.push({
        title: "Analytics",
        url: "#",
        icon: ChartBar,
        items: [
          {
            title: "Overview",
            url: "#",
            section: "overview",
          },
          {
            title: "Performance",
            url: "#",
            section: "performance",
          },
          {
            title: "Reports",
            url: "#",
            section: "reports",
          },
          {
            title: "Logs",
            url: "#",
            section: "logs",
          },
        ],
      });
    }

    // Create - Available from instructor level and up
    if (["instructor", "instructional", "admin"].includes(effectiveRole)) {
      menu.push({
        title: "Create",
        url: "#",
        icon: Sparkles,
        items: [
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
          {
            title: "Rubrics",
            url: "#",
            section: "rubrics",
          },
        ],
      });
    }

    // Classes - Available from instructor level and up
    if (["instructor", "instructional", "admin"].includes(effectiveRole)) {
      const classItems: MenuItem[] = [];

      // Add specific classes based on role
      if (availableClasses.length > 0) {
        availableClasses.forEach((cls: ClassData) => {
          classItems.push({
            title: cls.classCode,
            url: "#",
            section: `class-${cls.id}`,
            classData: cls,
          });
        });
      }

      menu.push({
        title: "Classes",
        url: "#",
        icon: GraduationCap,
        items: classItems,
      });
    }

    // Management - Available from admin level only
    if (["admin"].includes(effectiveRole)) {
      const managementItems: MenuItem[] = [];

      // Staff management - always available for admin
      managementItems.push({
        title: "Staff",
        url: "#",
        section: "staff",
      });

      // Classes - available for admin
      managementItems.push({
        title: "Classes",
        url: "#",
        section: "classes",
      });

      // Agents - available for admin
      managementItems.push({
        title: "Agents",
        url: "#",
        section: "agents",
      });

      // Evaluations - available for admin
      managementItems.push({
        title: "Evaluations",
        url: "#",
        section: "evals",
      });

      menu.push({
        title: "Management",
        url: "#",
        icon: Settings,
        items: managementItems,
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
                item.section?.toLowerCase().includes(searchTerm.toLowerCase()),
            ) || [],
        }))
        .filter((section) => section.items.length > 0);

      return filteredMenu;
    }

    return menu;
  }, [effectiveRole, availableClasses, searchTerm]);

  // Note: Removed automatic navigation when section is not available
  // This was causing unwanted redirects. Let the parent component handle navigation logic.

  const handleSectionChange = createFlexibleSectionChangeHandler(
    router,
    onSectionChange,
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

  const handleModeChange = (mode: string) => {
    if (mode === "guest") {
      setRole("guest", true); // Navigate to guest default page
    } else if (mode === profile?.role) {
      setRole(null, true); // Reset to actual user role and navigate
    } else {
      setRole(mode as ProfileRole, true); // Set simulated role and navigate
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const handleLoginOrLogout = async () => {
    if (effectiveRole === "guest" || !profile) {
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
          await signOut({redirectTo: "/"});
          return "Logged out successfully";
        } catch (error) {
          console.error("Error logging out:", error);
          throw new Error(
            typeof error === "string" ? error : "Failed to log out",
          );
        } finally {
          setIsLoggingOut(false);
        }
      },
      {
        loading: "Logging out...",
        success: (message) => message,
        error: (error) => error.message || "Failed to log out",
      },
    );
  };

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        {/* Mode Switcher */}
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                    <BookOpen className="size-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-medium">GLOW</span>
                    <span className="text-xs">{currentModeLabel}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width]"
                align="start"
              >
                {availableModes.map((mode) => (
                  <DropdownMenuItem
                    key={mode.key}
                    onSelect={() => handleModeChange(mode.key)}
                  >
                    {mode.label}
                    {mode.key === effectiveRole && (
                      <Check className="ml-auto size-4" />
                    )}
                  </DropdownMenuItem>
                ))}
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
                        section: item.section,
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
                            {subItem.isSubItem && (
                              <FileText className="h-3 w-3 mr-2" />
                            )}
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
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {effectiveRole === "guest" || !profile
                        ? "GU"
                        : getInitials(profile?.firstName + " " + profile?.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {effectiveRole === "guest" || !profile
                        ? "Guest User"
                        : profile?.firstName + " " + profile?.lastName}
                    </span>
                    <span className="truncate text-xs">
                      {effectiveRole === "guest" || !profile
                        ? "Not logged in"
                        : `${profile?.alias}@purdue.edu`}
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
                        {effectiveRole === "guest" || !profile
                          ? "GU"
                          : getInitials(profile?.firstName + " " + profile?.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {effectiveRole === "guest" || !profile
                          ? "Guest User"
                          : profile?.firstName + " " + profile?.lastName}
                      </span>
                      <span className="truncate text-xs">
                        {effectiveRole === "guest" || !profile
                          ? "Not logged in"
                          : `${profile?.alias}@purdue.edu`}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {profile && effectiveRole !== "guest" && (
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
                    : effectiveRole === "guest" || !profile
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
