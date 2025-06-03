"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { UnifiedSidebar } from "@/components/unified-sidebar";

// Helper function to generate breadcrumbs from pathname
const generateBreadcrumbs = (pathname: string) => {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = [];
  
  // Remove 'dashboard' from segments since it's the base
  const relevantSegments = segments.slice(1);
  
  for (let i = 0; i < relevantSegments.length; i++) {
    const segment = relevantSegments[i];
    const path = '/' + segments.slice(0, i + 2).join('/');
    
    // Convert segment to readable title
    let title = segment;
    switch (segment) {
      case 'home':
        title = 'Home';
        break;
      case 'history':
        title = 'History';
        break;
      default:
        title = segment.charAt(0).toUpperCase() + segment.slice(1);
    }
    
    breadcrumbs.push({
      title,
      section: segment
    });
  }
  
  return breadcrumbs;
};

// Helper function to get active section from pathname
const getActiveSectionFromPath = (pathname: string) => {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) return 'home';
  
  const section = segments[1]; // Get the section after /dashboard/
  
  // Handle special cases
  if (segments[0] === 'classes' && segments[1] === 'general') {
    return 'add-class';
  }
  if (segments[0] === 'classes' && segments[1] === 'c') {
    return `class-${segments[2]}`;
  }
  if (segments[0] === 'chat') {
    return `chat-${segments[1]}`;
  }
  if (segments[0] === 'management') {
    return `manage-${segments[1]}`;
  }
  
  return section;
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeSection = getActiveSectionFromPath(pathname);
  const breadcrumbs = generateBreadcrumbs(pathname);

  const handleSectionChange = (section: string) => {
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
    window.location.href = route;
  };

  return (
    <SidebarProvider>
      <UnifiedSidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        breadcrumbs={breadcrumbs}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
} 