"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UnifiedSidebar } from "@/components/common/layout/unified-sidebar";
import { NavigationBreadcrumbs } from "@/components/common/layout/navigation-breadcrumbs";
import { RoleProvider } from "@/contexts/role-context";
import { ViewModeProvider } from "@/contexts/view-mode-context";
import { generateEnhancedBreadcrumbs, getActiveSectionFromPath } from "@/utils/breadcrumb-utils";
import { createSectionChangeHandler } from "@/utils/navigation-utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getUser } from "@/utils/queries/users/get-user";
import { getClass } from "@/utils/queries/classes/get-class";
import { deleteClass } from "@/utils/mutations/classes/delete-class";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const activeSection = getActiveSectionFromPath(pathname);
  const [breadcrumbs, setBreadcrumbs] = React.useState<Array<{ title: string; section?: string }>>([]);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'chats' | 'attempts'>('attempts');
  const { userId } = useAuth();

  // Extract classId from edit page path or new class status page path
  const classEditPageMatch = pathname.match(/^\/classes\/c\/([^\/]+)\/edit$/);
  const newClassPageMatch = pathname.match(/^\/classes\/new\/c\/([^\/]+)$/);
  const classId = classEditPageMatch?.[1] || newClassPageMatch?.[1];

  // Check if we're on the logs page
  const isLogsPage = pathname === '/analytics/logs';

  // Fetch user data for role context
  const { data: user } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => getUser(userId!),
    enabled: !!userId,
  });

  // Fetch class data for delete confirmation
  const { data: classData } = useQuery({
    queryKey: ["class", classId],
    queryFn: () => getClass(classId!),
    enabled: !!classId,
  });

  // Load enhanced breadcrumbs with async ID resolution
  React.useEffect(() => {
    const loadBreadcrumbs = async () => {
      const enhancedBreadcrumbs = await generateEnhancedBreadcrumbs(pathname);
      setBreadcrumbs(enhancedBreadcrumbs);
    };
    loadBreadcrumbs();
  }, [pathname]);

  const handleSectionChange = createSectionChangeHandler(router, '/simulations');

  // Create view mode toggle for history page
  const viewModeToggle = isLogsPage ? (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-muted-foreground">Show individual chats</span>
      <Switch
        checked={viewMode === 'chats'}
        onCheckedChange={(checked) => setViewMode(checked ? 'chats' : 'attempts')}
      />
    </div>
  ) : null;

  const handleDeleteClass = async () => {
    if (!classId) return;

    setIsDeleting(true);
    try {
      await deleteClass(classId);
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Class deleted successfully!");
      router.push('/classes');
    } catch (error) {
      toast.error(`Failed to delete class: ${error instanceof Error ? error.message : "Unknown error"}`);
      console.error("Error deleting class:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Determine action button based on current path
  const getActionButton = () => {
    // Don't show create buttons on the creation pages themselves
    if (pathname.includes('/t/') || pathname.includes('/s/') || pathname.includes('/p/') || pathname.includes('/u/')) {
      return null;
    }
    // Check for individual class page pattern: /classes/c/[classId]
    const classPageMatch = pathname.match(/^\/classes\/c\/([^\/]+)(?:\/.*)?$/);
    if (classPageMatch && !pathname.includes('/edit')) {
      const classId = classPageMatch[1];
      return (
        <Button onClick={() => router.push(`/classes/c/${classId}/edit`)} size="sm" variant="default">
          <Pencil className="h-4 w-4 mr-2" />
          Edit Class
        </Button>
      );
    }

    // Check for new class status page pattern: /classes/new/[classId]
    if (newClassPageMatch) {
      const classId = newClassPageMatch[1];
      return (
        <Button onClick={() => router.push(`/classes/c/${classId}/edit`)} size="sm" variant="default">
          <Pencil className="h-4 w-4 mr-2" />
          Edit Class
        </Button>
      );
    }

    // Check for class edit page pattern: /classes/c/[classId]/edit
    if (classEditPageMatch && classData) {
      return (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive" disabled={isDeleting}>
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? "Deleting..." : "Delete Class"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the class
                "{classData.classCode}" and remove all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteClass}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Deleting..." : "Delete Class"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    }

    if (pathname.startsWith('/create/scenarios')) {
      return (
        <Button onClick={() => router.push('/create/scenarios/new')} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Scenario
        </Button>
      );
    }

    if (pathname.startsWith('/create/simulations')) {
      return (
        <Button onClick={() => router.push('/create/simulations/new')} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Simulation
        </Button>
      );
    }

    if (pathname.startsWith('/create/rubrics')) {
      return (
        <Button onClick={() => router.push('/create/rubrics/new')} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Rubric
        </Button>
      );
    }

    if (pathname.startsWith('/create/simulations/agents')) {
      return (
        <Button onClick={() => router.push('/simulations/agents/new')} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Agent
        </Button>
      );
    }

    if (pathname.startsWith('/classes') && !pathname.includes('/new')) {
      return (
        <Button onClick={() => router.push('/classes/new')} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Class
        </Button>
      );
    }

    if (pathname.startsWith('/management/staff')) {
      return (
        <Button onClick={() => router.push('/management/staff/new')} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Staff
        </Button>
      );
    }

    if (pathname.startsWith('/management/agents')) {
      return (
        <Button onClick={() => router.push('/management/agents/new')} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Agent
        </Button>
      );
    }

    if (pathname.startsWith('/management/evals')) {
      return (
        <Button onClick={() => router.push('/management/evals/new')} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Evaluation
        </Button>
      );
    }



    return null;
  };

  const actionButton = getActionButton();

  const content = (
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
                rightContent={viewModeToggle}
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

  // Only provide ViewModeProvider context for logs page
  if (isLogsPage) {
    return (
      <ViewModeProvider viewMode={viewMode} setViewMode={setViewMode}>
        {content}
      </ViewModeProvider>
    );
  }

  return content;
} 