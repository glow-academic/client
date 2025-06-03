import * as React from "react"
import { ChevronRight, Home, BookOpen, FileText, HelpCircle, GraduationCap, MessageSquare, Settings, Search, User, LogOut, Eye, Check, ChevronsUpDown, Clock, Plus } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { getClasses } from "@/utils/queries/get-classes"
import { getUser } from "@/utils/queries/get-user"
import { logout } from "@/utils/mutations/logout"
import { getAttempts } from "@/utils/queries/get-attempts"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type UserRole = 'admin' | 'instructional' | 'instructor' | 'ta'

interface UnifiedSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeSection: string
  onSectionChange?: (section: string) => void
  breadcrumbs?: Array<{ title: string; section?: string }>
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

// Guest mode management
const useGuestMode = () => {
  const [isGuestMode, setIsGuestMode] = React.useState(false);
  const [guestAttemptIds, setGuestAttemptIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    const stored = localStorage.getItem('guestAttemptIds');
    if (stored) {
      setGuestAttemptIds(JSON.parse(stored));
    }
  }, []);

  const enableGuestMode = () => {
    setIsGuestMode(true);
  };

  const disableGuestMode = () => {
    setIsGuestMode(false);
  };

  const addGuestAttempt = (attemptId: string) => {
    const newIds = [...guestAttemptIds, attemptId];
    setGuestAttemptIds(newIds);
    localStorage.setItem('guestAttemptIds', JSON.stringify(newIds));
  };

  return { isGuestMode, guestAttemptIds, enableGuestMode, disableGuestMode, addGuestAttempt };
};

// Role simulation for admins and TAs
const useRoleSimulation = () => {
  const [simulatedRole, setSimulatedRole] = React.useState<UserRole | 'guest' | null>(null);

  React.useEffect(() => {
    const stored = localStorage.getItem('simulatedRole');
    if (stored && ['admin', 'instructional', 'instructor', 'ta', 'guest'].includes(stored)) {
      setSimulatedRole(stored as UserRole | 'guest');
    }
  }, []);

  const setRole = (role: UserRole | 'guest' | null) => {
    setSimulatedRole(role);
    if (role) {
      localStorage.setItem('simulatedRole', role);
    } else {
      localStorage.removeItem('simulatedRole');
    }
  };

  return { simulatedRole, setRole };
};

// Helper function to get hierarchical modes based on user role
const getAvailableModes = (userRole: UserRole) => {
  const roleLabels = {
    admin: 'Administrator',
    instructional: 'Instructional Staff',
    instructor: 'Instructor',
    ta: 'Teaching Assistant'
  };

  const roleHierarchy = ['admin', 'instructional', 'instructor', 'ta'];
  const userIndex = roleHierarchy.indexOf(userRole);
  
  if (userIndex === -1) return [];

  const availableRoles = roleHierarchy.slice(userIndex);
  const modes = availableRoles.map(role => ({
    key: role,
    label: roleLabels[role as UserRole]
  }));

  // All roles can access guest mode
  modes.push({ key: 'guest', label: 'Guest Mode' });

  return modes;
};

// Helper function to get management tabs based on role
const getManagementTabs = (effectiveRole: UserRole | 'guest') => {
  const tabs = [];

  if (effectiveRole === 'admin') {
    tabs.push(
      { key: 'instructional-staff', label: 'Instructional Staff', section: 'manage-instructional' },
      { key: 'instructors', label: 'Instructors', section: 'manage-instructors' },
      { key: 'teaching-assistants', label: 'Teaching Assistants', section: 'manage-tas' }
    );
  } else if (effectiveRole === 'instructional') {
    tabs.push(
      { key: 'instructors', label: 'Instructors', section: 'manage-instructors' },
      { key: 'teaching-assistants', label: 'Teaching Assistants', section: 'manage-tas' }
    );
  } else if (effectiveRole === 'instructor') {
    tabs.push(
      { key: 'teaching-assistants', label: 'Teaching Assistants', section: 'manage-tas' }
    );
  }

  return tabs;
};

export function UnifiedSidebar({ activeSection, onSectionChange, breadcrumbs, ...props }: UnifiedSidebarProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const { simulatedRole, setRole: setSimulatedRole } = useRoleSimulation();
  const { isGuestMode, guestAttemptIds, enableGuestMode, disableGuestMode } = useGuestMode();

  // Fetch user data
  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser(),
  });

  // Fetch classes for dynamic menu
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getClasses(),
  });

  // Determine effective role (simulated role for admins/TAs, or actual role)
  const effectiveRole = isGuestMode ? 'guest' : (simulatedRole || user?.role || 'guest');

  // Fetch attempts with chats for guest mode
  const { data: guestAttempts = [] } = useQuery({
    queryKey: ["attempts"],
    queryFn: () => getAttempts(),
    enabled: effectiveRole === 'guest',
  });

  // Get available modes based on user role
  const availableModes = React.useMemo(() => {
    if (!user?.role) return [{ key: 'guest', label: 'Guest Mode' }];
    return getAvailableModes(user.role);
  }, [user?.role]);

  // Get current mode label
  const currentModeLabel = React.useMemo(() => {
    const mode = availableModes.find(m => m.key === effectiveRole);
    return mode?.label || 'Guest Mode';
  }, [availableModes, effectiveRole]);

  // Filter classes based on user role
  const availableClasses = React.useMemo(() => {
    if (!user || !classes || effectiveRole === 'guest') return [];
    
    switch (effectiveRole) {
      case 'admin':
      case 'instructional':
        return classes; // Full access
      case 'instructor':
        // Only classes the user is assigned to
        return classes.filter((cls: any) => user.classIds?.includes(cls.id));
      case 'ta':
        return []; // No class access for TAs
      default:
        return [];
    }
  }, [classes, user, effectiveRole]);

  // Get management tabs based on current role
  const managementTabs = React.useMemo(() => {
    return getManagementTabs(effectiveRole);
  }, [effectiveRole]);

  // Build navigation menu based on role with search filtering
  const navMain = React.useMemo(() => {
    const menu = [];

    if (effectiveRole === 'guest') {
      // Guest mode - simplified like TA mode, just dashboard
      menu.push({
        title: "Dashboard",
        url: "#",
        icon: Home,
        items: [
          {
            title: "Home",
            url: "#",
            section: "home",
          },
          {
            title: "History",
            url: "#",
            section: "history",
          },
        ],
      });
    } else if (effectiveRole === 'ta') {
      // TA mode - only dashboard with home and history
      menu.push({
        title: "Dashboard",
        url: "#",
        icon: Home,
        items: [
          {
            title: "Home",
            url: "#",
            section: "home",
          },
          {
            title: "History",
            url: "#",
            section: "history",
          },
        ],
      });
    } else {
      // Other roles - full dashboard
      menu.push({
        title: "Dashboard",
        url: "#",
        icon: Home,
        items: [
          {
            title: "Home",
            url: "#",
            section: "home",
          },
          {
            title: "History",
            url: "#",
            section: "history",
          },
        ],
      });

      // Classes section - for admin, instructional, and instructor
      if (availableClasses.length > 0 || effectiveRole === 'instructor') {
        const classItems: any[] = availableClasses.map((cls: any) => ({
          title: cls.classCode,
          url: "#",
          section: `class-${cls.id}`,
          classData: cls,
        }));

        if (effectiveRole === 'admin' || effectiveRole === 'instructional') {
          classItems.unshift({
            title: "General",
            url: "#",
            section: "add-class",
          });
        }

        menu.push({
          title: "Classes",
          url: "#",
          icon: GraduationCap,
          items: classItems,
        });
      }

      // Chat management - for admin and instructional
      if (['admin', 'instructional'].includes(effectiveRole)) {
        menu.push({
          title: "Chat",
          url: "#",
          icon: MessageSquare,
          items: [
            {
              title: "Templates",
              url: "#",
              section: "chat-templates",
            },
            {
              title: "Profiles",
              url: "#",
              section: "chat-profiles",
            },
            {
              title: "Scenarios",
              url: "#",
              section: "chat-scenarios",
            },
          ],
        });
      }

      // Management section - hierarchical tabs based on role
      if (managementTabs.length > 0) {
        menu.push({
          title: "Management",
          url: "#",
          icon: Settings,
          items: managementTabs.map(tab => ({
            title: tab.label,
            url: "#",
            section: tab.section,
          })),
        });
      }
    }

    // Apply search filter if search term exists
    if (searchTerm.trim()) {
      const filteredMenu = menu.map(section => ({
        ...section,
        items: section.items?.filter(item =>
          item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.section?.toLowerCase().includes(searchTerm.toLowerCase())
        ) || []
      })).filter(section => section.items.length > 0);
      
      return filteredMenu;
    }

    return menu;
  }, [effectiveRole, availableClasses, managementTabs, searchTerm]);

  const handleSectionChange = (section: string) => {
    // If onSectionChange prop is provided, use it (for layout components)
    if (onSectionChange) {
      onSectionChange(section);
      return;
    }

    // Otherwise, handle navigation internally
    // Convert section to route
    let route = '/dashboard/home';
    
    switch (section) {
      case 'home':
        route = '/dashboard/home';
        break;
      case 'history':
        route = '/dashboard/history';
        break;
      case 'profile':
        route = '/profile';
        break;
      case 'chat-templates':
        route = '/chat/templates';
        break;
      case 'chat-profiles':
        route = '/chat/profiles';
        break;
      case 'chat-scenarios':
        route = '/chat/scenarios';
        break;
      case 'add-class':
        route = '/classes/general';
        break;
      case 'manage-instructional':
        route = '/management/instructional';
        break;
      case 'manage-instructors':
        route = '/management/instructor';
        break;
      case 'manage-tas':
        route = '/management/ta';
        break;
      default:
        if (section.startsWith('class-')) {
          const classId = section.replace('class-', '');
          route = `/classes/c/${classId}`;
        }
        break;
    }
    
    // Use Next.js router to navigate
    router.push(route);
  };

  const handleItemClick = (item: any) => {
    if (item.url && item.url !== "#") {
      // Navigate to the URL (for attempts)
      router.push(item.url);
    } else if (item.section) {
      // Handle section changes
      handleSectionChange(item.section);
    }
  };

  const handleModeChange = (mode: string) => {
    if (mode === 'guest') {
      if (effectiveRole !== 'guest') {
        enableGuestMode();
        setSimulatedRole('guest');
      }
    } else {
      if (isGuestMode) {
        disableGuestMode();
      }
      if (mode === user?.role) {
        setSimulatedRole(null);
      } else {
        setSimulatedRole(mode as UserRole);
      }
    }
    // Force a small delay to ensure state updates are processed
    setTimeout(() => {
      // This will trigger a re-render with updated effective role
    }, 10);
  };

  const handleBreadcrumbClick = (section?: string) => {
    if (section) {
      handleSectionChange(section);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const handleLoginOrLogout = async () => {
    if (effectiveRole === 'guest' || !user) {
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
          localStorage.removeItem('guestAttemptIds');
          localStorage.removeItem('simulatedRole');
          
          const { success, error } = await logout();
          if (success) {
            router.push("/");
            return "Logged out successfully";
          } else {
            throw new Error(error);
          }
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
                    {mode.key === effectiveRole && <Check className="ml-auto size-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <SidebarGroup className="py-0">
            <SidebarGroupContent>
              <Breadcrumb>
                <BreadcrumbList>
                  {breadcrumbs.map((crumb, index) => (
                    <React.Fragment key={index}>
                      <BreadcrumbItem>
                        {index === breadcrumbs.length - 1 ? (
                          <BreadcrumbPage>{crumb.title}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink
                            className="cursor-pointer"
                            onClick={() => handleBreadcrumbClick(crumb.section)}
                          >
                            {crumb.title}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                    </React.Fragment>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        
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
        {navMain.map((item) => (
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
                    {item.items?.map((subItem: any) => (
                      <SidebarMenuItem key={subItem.title}>
                        <SidebarMenuButton 
                          isActive={activeSection === subItem.section}
                          onClick={() => handleItemClick(subItem)}
                          className={subItem.isSubItem ? "pl-8 text-sm" : ""}
                        >
                          {subItem.isSubItem && <FileText className="h-3 w-3 mr-2" />}
                          {subItem.title}
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
                      {effectiveRole === 'guest' || !user ? 'GU' : getInitials(user?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {effectiveRole === 'guest' || !user ? 'Guest User' : user?.name}
                    </span>
                    <span className="truncate text-xs">
                      {effectiveRole === 'guest' || !user ? 'Not logged in' : `${user?.username}@purdue.edu`}
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
                        {effectiveRole === 'guest' || !user ? 'GU' : getInitials(user?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {effectiveRole === 'guest' || !user ? 'Guest User' : user?.name}
                      </span>
                      <span className="truncate text-xs">
                        {effectiveRole === 'guest' || !user ? 'Not logged in' : `${user?.username}@purdue.edu`}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user && effectiveRole !== 'guest' && (
                  <>
                    <DropdownMenuItem onClick={() => handleSectionChange('profile')}>
                      <User className="h-4 w-4 mr-2" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={handleLoginOrLogout}
                  disabled={isLoggingOut}
                  className={isLoggingOut ? "opacity-70 cursor-not-allowed" : ""}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {isLoggingOut ? "Logging out..." : (effectiveRole === 'guest' || !user) ? "Log in" : "Log out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
} 