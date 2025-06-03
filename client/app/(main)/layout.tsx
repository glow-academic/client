"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { UnifiedSidebar } from "@/components/unified-sidebar";

// Helper function to generate breadcrumbs from pathname
const generateBreadcrumbs = (pathname: string) => {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = [];
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    
    // Convert segment to readable title
    let title = segment;
    switch (segment) {
      case 'chat':
        title = 'Chat';
        break;
      case 'templates':
        title = 'Templates';
        break;
      case 'profiles':
        title = 'Profiles';
        break;
      case 'scenarios':
        title = 'Scenarios';
        break;
      case 'classes':
        title = 'Classes';
        break;
      case 'general':
        title = 'General';
        break;
      case 'management':
        title = 'Management';
        break;
      case 'instructional':
        title = 'Instructional Staff';
        break;
      case 'instructor':
        title = 'Instructors';
        break;
      case 'ta':
        title = 'Teaching Assistants';
        break;
      case 'profile':
        title = 'Profile';
        break;
      case 'new':
        title = 'New';
        break;
      case 'c':
        title = 'Class';
        break;
      case 't':
        title = 'Template';
        break;
      case 'p':
        title = 'Profile';
        break;
      case 's':
        title = 'Scenario';
        break;
      default:
        // For IDs, try to make them more readable
        if (segment.length > 10) {
          title = `ID: ${segment.substring(0, 8)}...`;
        } else {
          title = segment.charAt(0).toUpperCase() + segment.slice(1);
        }
    }
    
    breadcrumbs.push({
      title,
      section: getSectionFromSegments(segments.slice(0, i + 1))
    });
  }
  
  return breadcrumbs;
};

// Helper function to get section from path segments
const getSectionFromSegments = (segments: string[]) => {
  if (segments.length === 0) return 'home';
  
  const [first, second, third] = segments;
  
  // Handle special cases
  if (first === 'classes' && second === 'general') {
    return 'add-class';
  }
  if (first === 'classes' && second === 'c') {
    return `class-${third}`;
  }
  if (first === 'chat') {
    return `chat-${second}`;
  }
  if (first === 'management') {
    return `manage-${second}`;
  }
  if (first === 'profile') {
    return 'profile';
  }
  
  return segments.join('-');
};

// Helper function to get active section from pathname
const getActiveSectionFromPath = (pathname: string) => {
  const segments = pathname.split('/').filter(Boolean);
  return getSectionFromSegments(segments);
};

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
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
    
    router.push(route);
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