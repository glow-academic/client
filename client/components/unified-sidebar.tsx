import * as React from "react"
import { ChevronRight, Home, BookOpen, FileText, HelpCircle, GraduationCap, MessageSquare, Settings, Search, User, LogOut, Eye } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { getClasses } from "@/utils/queries/get-classes"
import { getUser } from "@/utils/queries/get-user"
import { logout } from "@/utils/mutations/logout"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type UserRole = 'admin' | 'instructional' | 'instructor' | 'ta' | 'guest'

interface UnifiedSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeSection: string
  onSectionChange: (section: string) => void
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

// Role simulation for admins
const useRoleSimulation = () => {
  const [simulatedRole, setSimulatedRole] = React.useState<UserRole | null>(null);

  React.useEffect(() => {
    const stored = localStorage.getItem('simulatedRole');
    if (stored && ['admin', 'instructional', 'instructor', 'ta', 'guest'].includes(stored)) {
      setSimulatedRole(stored as UserRole);
    }
  }, []);

  const setRole = (role: UserRole | null) => {
    setSimulatedRole(role);
    if (role) {
      localStorage.setItem('simulatedRole', role);
    } else {
      localStorage.removeItem('simulatedRole');
    }
  };

  return { simulatedRole, setRole };
};

export function UnifiedSidebar({ activeSection, onSectionChange, ...props }: UnifiedSidebarProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const { simulatedRole, setRole: setSimulatedRole } = useRoleSimulation();

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

  // Determine effective role (simulated role for admins, or actual role)
  const effectiveRole: UserRole = React.useMemo(() => {
    if (!user) return 'guest';
    if (user.role === 'admin' && simulatedRole) return simulatedRole;
    return user.role as UserRole;
  }, [user?.role, simulatedRole]);

  // Filter classes based on user role
  const availableClasses = React.useMemo(() => {
    if (!user || !classes) return [];
    
    switch (effectiveRole) {
      case 'admin':
      case 'instructional':
        return classes; // Full access
      case 'instructor':
        // Only classes the user is assigned to
        return classes.filter((cls: any) => user.classIds?.includes(cls.id));
      case 'ta':
      case 'guest':
        return []; // No class access
      default:
        return [];
    }
  }, [classes, user, effectiveRole]);

  // Build navigation menu based on role
  const navMain = React.useMemo(() => {
    const menu = [];

    // Dashboard section - available to all roles
    if (effectiveRole !== 'guest') {
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
          ...(effectiveRole !== 'ta' ? [{
            title: "History",
            url: "#",
            section: "history",
          }] : []),
        ],
      });
    } else {
      // Guest only gets home chat
      menu.push({
        title: "Chat",
        url: "#",
        icon: MessageSquare,
        items: [
          {
            title: "Start Chat",
            url: "#",
            section: "home",
          },
        ],
      });
    }

    // Classes section - for admin, instructional, and instructor
    if (availableClasses.length > 0) {
      menu.push({
        title: "Classes",
        url: "#",
        icon: GraduationCap,
        items: availableClasses.map((cls: any) => ({
          title: cls.classCode,
          url: "#",
          section: `class-${cls.id}`,
          classData: cls,
        })),
      });
    }

    // Quizzes section - for admin and instructional
    if (['admin', 'instructional'].includes(effectiveRole)) {
      menu.push({
        title: "Quizzes",
        url: "#",
        icon: HelpCircle,
        items: [
          {
            title: "View Quizzes",
            url: "#",
            section: "quiz-list",
          },
          {
            title: "Create Quiz",
            url: "#",
            section: "quiz-create",
          },
        ],
      });
    }

    // Chat management - for admin and instructional
    if (['admin', 'instructional'].includes(effectiveRole)) {
      menu.push({
        title: "Chat Management",
        url: "#",
        icon: MessageSquare,
        items: [
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

    // Student management - for admin and instructional
    if (['admin', 'instructional'].includes(effectiveRole)) {
      menu.push({
        title: "Management",
        url: "#",
        icon: Settings,
        items: [
          {
            title: "Students",
            url: "#",
            section: "student-management",
          },
        ],
      });
    }

    return menu;
  }, [effectiveRole, availableClasses]);

  const handleItemClick = (item: any) => {
    if (item.section) {
      onSectionChange(item.section);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);

    toast.promise(
      async () => {
        try {
          // Clear guest mode if it exists
          localStorage.removeItem('guestMode');
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

  const roleDisplayNames = {
    admin: 'Administrator',
    instructional: 'Instructional Staff',
    instructor: 'Instructor',
    ta: 'Teaching Assistant',
    guest: 'Guest'
  };

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-2">
          <BookOpen className="h-6 w-6" />
          <span className="font-semibold text-lg">GLOW</span>
        </div>
        
        {/* Search Form */}
        <SidebarGroup className="py-0">
          <SidebarGroupContent className="relative">
            <Label htmlFor="search" className="sr-only">
              Search
            </Label>
            <SidebarInput
              id="search"
              placeholder="Search..."
              className="pl-8"
            />
            <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Role Simulation for Admins */}
        {user?.role === 'admin' && (
          <SidebarGroup className="py-0">
            <SidebarGroupContent>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className="w-full justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      <span className="text-sm">View as: {roleDisplayNames[effectiveRole]}</span>
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Simulate Role</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSimulatedRole(null)}>
                    <span>Admin (Default)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSimulatedRole('instructional')}>
                    <span>Instructional Staff</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSimulatedRole('instructor')}>
                    <span>Instructor</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSimulatedRole('ta')}>
                    <span>Teaching Assistant</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSimulatedRole('guest')}>
                    <span>Guest</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
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
                    {item.items?.map((subItem) => (
                      <SidebarMenuItem key={subItem.title}>
                        <SidebarMenuButton 
                          isActive={activeSection === subItem.section}
                          onClick={() => handleItemClick(subItem)}
                          className={(subItem as any).isSubItem ? "pl-8 text-sm" : ""}
                        >
                          {(subItem as any).isSubItem && <FileText className="h-3 w-3 mr-2" />}
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
                    <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user?.name}</span>
                    <span className="truncate text-xs">{user?.username}@purdue.edu</span>
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
                      <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user?.name}</span>
                      <span className="truncate text-xs">{user?.username}@purdue.edu</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onSectionChange('profile')}>
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className={isLoggingOut ? "opacity-70 cursor-not-allowed" : ""}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {isLoggingOut ? "Logging out..." : "Log out"}
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