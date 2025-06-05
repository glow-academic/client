"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, Settings } from "lucide-react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { UnifiedSidebar } from "@/components/unified-sidebar";
import { NavigationBreadcrumbs } from "@/components/navigation-breadcrumbs";
import { RoleProvider } from "@/components/role-context";
import { getUser } from "@/utils/queries/get-user";
import { generateEnhancedBreadcrumbs, getActiveSectionFromPath } from "@/utils/breadcrumb-utils";
import { createSectionChangeHandler } from "@/utils/navigation-utils";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const activeSection = getActiveSectionFromPath(pathname);
  const [breadcrumbs, setBreadcrumbs] = React.useState<Array<{ title: string; section?: string }>>([]);

  // Fetch user data for role context
  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser(),
  });

  // Load enhanced breadcrumbs with async ID resolution
  React.useEffect(() => {
    const loadBreadcrumbs = async () => {
      const enhancedBreadcrumbs = await generateEnhancedBreadcrumbs(pathname);
      setBreadcrumbs(enhancedBreadcrumbs);
    };
    loadBreadcrumbs();
  }, [pathname]);

  const handleSectionChange = createSectionChangeHandler(router, '/dashboard/chats');

  // Determine action button based on current path
  const getActionButton = () => {
    // Don't show create buttons on the creation pages themselves
    if (pathname.includes('/new') || pathname.includes('/t/') || pathname.includes('/s/') || pathname.includes('/p/') || pathname.includes('/u/')) {
      return null;
    }
    
    // Check for individual class page pattern: /classes/c/[classId]
    const classPageMatch = pathname.match(/^\/classes\/c\/([^\/]+)(?:\/.*)?$/);
    if (classPageMatch && !pathname.includes('/settings')) {
      const classId = classPageMatch[1];
      return (
        <Button onClick={() => router.push(`/classes/c/${classId}/settings`)} size="sm" variant="default">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      );
    }
    
    if (pathname.startsWith('/chat/templates')) {
      return (
        <Button onClick={() => router.push('/chat/templates/new')} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      );
    }
    
    if (pathname.startsWith('/chat/profiles')) {
      return (
        <Button onClick={() => router.push('/chat/profiles/new')} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Profile
        </Button>
      );
    }
    
    if (pathname.startsWith('/chat/scenarios')) {
      return (
        <Button onClick={() => router.push('/chat/scenarios/new')} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Scenario
        </Button>
      );
    }
    
    if (pathname.startsWith('/classes/general')) {
      return (
        <Button onClick={() => router.push('/classes/new')} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Class
        </Button>
      );
    }
    
    if (pathname.startsWith('/management/instructional')) {
      return (
        <Button onClick={() => router.push('/management/instructional/new')} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Instructional Staff
        </Button>
      );
    }
    
    if (pathname.startsWith('/management/instructor')) {
      return (
        <Button onClick={() => router.push('/management/instructor/new')} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Instructor
        </Button>
      );
    }
    
    if (pathname.startsWith('/management/ta')) {
      return (
        <Button onClick={() => router.push('/management/ta/new')} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Teaching Assistant
        </Button>
      );
    }
    
    return null;
  };

  const actionButton = getActionButton();

  return (
    <RoleProvider userRole={user?.role}>
      <SidebarProvider>
        <UnifiedSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
        />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4 flex-1">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <NavigationBreadcrumbs 
                breadcrumbs={breadcrumbs}
                onSectionChange={handleSectionChange}
              />
            </div>
            {actionButton && (
              <div className="px-4">
                {actionButton}
              </div>
            )}
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </RoleProvider>
  );
} 