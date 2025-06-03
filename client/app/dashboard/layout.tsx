"use client";
import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { UnifiedSidebar } from "@/components/unified-sidebar";
import { NavigationBreadcrumbs } from "@/components/navigation-breadcrumbs";
import { generateEnhancedBreadcrumbs, getActiveSectionFromPath } from "@/utils/breadcrumb-utils";

// Create context for view mode
const ViewModeContext = React.createContext<{
  viewMode: 'chats' | 'attempts';
  setViewMode: (mode: 'chats' | 'attempts') => void;
} | null>(null);

export const useViewMode = () => {
  const context = React.useContext(ViewModeContext);
  if (!context) {
    throw new Error('useViewMode must be used within ViewModeProvider');
  }
  return context;
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const activeSection = getActiveSectionFromPath(pathname);
  const [breadcrumbs, setBreadcrumbs] = React.useState<Array<{ title: string; section?: string }>>([]);
  const [viewMode, setViewMode] = React.useState<'chats' | 'attempts'>('attempts');

  // Check if we're on the history page
  const isHistoryPage = pathname === '/dashboard/history';

  // Load enhanced breadcrumbs with async ID resolution
  React.useEffect(() => {
    const loadBreadcrumbs = async () => {
      const enhancedBreadcrumbs = await generateEnhancedBreadcrumbs(pathname);
      setBreadcrumbs(enhancedBreadcrumbs);
    };
    loadBreadcrumbs();
  }, [pathname]);

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
    router.push(route);
  };

  // Create view mode toggle for history page
  const viewModeToggle = isHistoryPage ? (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-muted-foreground">Show individual chats</span>
      <Switch
        checked={viewMode === 'chats'}
        onCheckedChange={(checked) => setViewMode(checked ? 'chats' : 'attempts')}
      />
    </div>
  ) : null;

  const content = (
    <SidebarProvider>
      <UnifiedSidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4 w-full">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <NavigationBreadcrumbs 
              breadcrumbs={breadcrumbs}
              onSectionChange={handleSectionChange}
              rightContent={viewModeToggle}
            />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );

  // Only provide context for history page
  if (isHistoryPage) {
    return (
      <ViewModeContext.Provider value={{ viewMode, setViewMode }}>
        {content}
      </ViewModeContext.Provider>
    );
  }

  return content;
} 