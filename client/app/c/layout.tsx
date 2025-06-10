/**
 * app/c/layout.tsx
 * Layout for the c section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { UnifiedSidebar } from "@/components/common/layout/unified-sidebar";
import { NavigationBreadcrumbs } from "@/components/common/layout/navigation-breadcrumbs";
import { RoleProvider } from "@/contexts/role-context";
import { getUser } from "@/utils/queries/users/get-user";
import {
  generateEnhancedBreadcrumbs,
  getActiveSectionFromPath,
} from "@/utils/breadcrumb-utils";
import { createSectionChangeHandler } from "@/utils/navigation-utils";
import { Clock, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

type WindowWithChatData = Window &
  typeof globalThis & {
    chatData: {
      elapsedTime: string;
      completed: boolean;
      passed?: boolean;
    };
  };

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const activeSection = getActiveSectionFromPath(pathname);
  const [breadcrumbs, setBreadcrumbs] = React.useState<
    Array<{ title: string; section?: string }>
  >([]);
  const [chatData, setChatData] = React.useState<{
    elapsedTime: string;
    completed: boolean;
    passed?: boolean;
  } | null>(null);

  const { userId } = useAuth();

  // Fetch user data for role context
  const { data: user } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => getUser(userId!),
    enabled: !!userId,
  });

  // Load enhanced breadcrumbs with async ID resolution
  React.useEffect(() => {
    const loadBreadcrumbs = async () => {
      const enhancedBreadcrumbs = await generateEnhancedBreadcrumbs(pathname);
      setBreadcrumbs(enhancedBreadcrumbs);
    };
    loadBreadcrumbs();
  }, [pathname]);

  // Listen for chat data updates from the chat page
  React.useEffect(() => {
    const checkChatData = () => {
      if (
        typeof window !== "undefined" &&
        (window as WindowWithChatData).chatData
      ) {
        setChatData((window as WindowWithChatData).chatData);
      }
    };

    // Check immediately
    checkChatData();

    // Set up interval to check for chat data updates
    const interval = setInterval(checkChatData, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleSectionChange = createSectionChangeHandler(router);

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

            {/* Timer and Status in top right corner */}
            {chatData && (
              <div className="flex items-center gap-2 mr-4">
                <div className="flex items-center gap-2 bg-muted px-3 py-1 rounded-full">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium" data-testid="timer">
                    {chatData.elapsedTime}
                  </span>
                </div>
                {chatData.completed && (
                  <Badge variant={chatData.passed ? "default" : "destructive"}>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                )}
              </div>
            )}
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </RoleProvider>
  );
}
