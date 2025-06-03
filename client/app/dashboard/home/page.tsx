/**
 * app/home/page.tsx
 * This is the unified home page with role-based access control
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Timer, Users } from "lucide-react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

import { UnifiedSidebar } from "@/components/unified-sidebar";
import { DataTable } from "@/components/tasks/data-table";
import { useTaskColumns } from "@/components/tasks/columns";
import Analytics from "@/components/Analytics";
import { getTemplates } from "@/utils/queries/get-templates";
import { getClasses } from "@/utils/queries/get-classes";
import { getClass } from "@/utils/queries/get-class";
import { getUser } from "@/utils/queries/get-user";
import Template from "@/components/Template";
import { TemplatesContent } from "@/components/admin/templates-content";
import { ProfilesContent } from "@/components/admin/profiles-content";
import { ScenariosContent } from "@/components/admin/scenarios-content";
import { StudentManagementContent } from "@/components/admin/student-management-content";
import { ClassDetailsContent } from "@/components/admin/class-details-content";
import { ProfileSection } from "@/components/profile-section";
import { ManagementSection } from "@/components/management-section";

type UserRole = 'admin' | 'instructional' | 'instructor' | 'ta' | 'guest'

export default function Home() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("home");
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'chats' | 'attempts'>('chats');
  const [isClient, setIsClient] = useState(false);

  // Handle client-side mounting
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Handle URL parameters for direct navigation
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section');
    if (section) {
      setActiveSection(section);
      // Clean up URL without triggering a reload
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser(),
  });

  // Get user role simulation - only run on client side
  const getEffectiveRole = (): UserRole => {
    if (!isClient) return 'guest'; // Default to guest during SSR
    
    // Check if in guest mode from localStorage
    const isGuestMode = localStorage.getItem('guestMode') === 'true';
    if (isGuestMode && !user) return 'guest';
    
    if (!user) return 'guest';
    const stored = localStorage.getItem('simulatedRole');
    if (user.role === 'admin' && stored && ['admin', 'instructional', 'instructor', 'ta', 'guest'].includes(stored)) {
      return stored as UserRole;
    }
    return (user.role as UserRole) || 'guest';
  };

  const effectiveRole = getEffectiveRole();
  const isAdmin = ['admin', 'instructional'].includes(effectiveRole);

  // Use the task columns hook
  const {
    columns,
    isLoading,
    data,
    userOptions,
    classOptions,
  } = useTaskColumns({ 
    isAdmin: effectiveRole === 'admin', 
    viewMode,
    effectiveRole: effectiveRole === 'guest' ? 'guest' : 'student'
  });

  // Only fetch classes and templates - optimize queries
  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getClasses(),
  });

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => getTemplates(),
  });

  // Extract class ID from active section if it's a class section
  const currentClassId = activeSection.startsWith("class-") ? activeSection.replace("class-", "") : null;

  // Fetch specific class data when viewing a class
  const { data: classDataArray } = useQuery({
    queryKey: ["class", currentClassId],
    queryFn: () => getClass(currentClassId!),
    enabled: !!currentClassId && isAdmin,
  });

  const classData = React.useMemo(() => {
    return Array.isArray(classDataArray) ? classDataArray[0] : classDataArray;
  }, [classDataArray]);

  const handleStartTemplate = async (templateId: string) => {
    try {
      if (!user) {
        toast.error("User not found. Please log in again.");
        return;
      }

      if (!classes) {
        toast.error("No classes found. Please contact an administrator.");
        return;
      }

      setLoadingTemplate(templateId);
      toast.loading("Starting template...");

      // For guests, use all available classes; for users, use their assigned classes or all if none assigned
      const availableClasses = effectiveRole === 'guest' 
        ? classes 
        : (user.classIds.length > 0 ? classes.filter(c => user.classIds.includes(c.id)) : classes);

      const classId = availableClasses.length > 0
        ? availableClasses[Math.floor(Math.random() * availableClasses.length)].id
        : classes[Math.floor(Math.random() * classes.length)].id;

      const formData = new FormData();
      formData.append("template_id", templateId);
      formData.append("user_id", user.id);
      formData.append("class_id", classId);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/attempt/start`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (response.ok) {
        const data = await response.json();
        toast.dismiss();
        toast.success("Template started");
        router.push(`/a/${data.attempt_id}`);
      } else {
        throw new Error(response.statusText || "Failed to start template");
      }
    } catch (error) {
      console.error("Error starting template:", error);
      toast.dismiss();
      toast.error("Failed to start template. Please try again.");
    } finally {
      setLoadingTemplate(null);
    }
  };

  // Get page title based on active section
  const getPageTitle = () => {
    if (activeSection === "home") return "Home";
    if (activeSection === "history") return "Chat History";
    if (activeSection === "profile") return "Profile";
    if (activeSection === "analytics") return "Analytics";
    if (activeSection === "documents") return "Documents";
    if (activeSection === "templates") return "Templates";
    if (activeSection === "profiles") return "Profiles";
    if (activeSection === "scenarios") return "Scenarios";
    if (activeSection === "template-list") return "Template List";
    if (activeSection === "template-create") return "Create Template";
    if (activeSection === "student-management") return "Student Management";
    if (activeSection === "manage-instructional") return "Manage Instructional Staff";
    if (activeSection === "manage-instructors") return "Manage Instructors";
    if (activeSection === "manage-tas") return "Manage Teaching Assistants";
    if (activeSection === "add-class") return "Add Class";
    if (activeSection.startsWith("class-") && classData) {
      return `${classData.classCode} - ${classData.name}`;
    }
    return "GLOW";
  };

  // Render content based on active section and role
  const renderContent = () => {
    switch (activeSection) {
      case "home":
        return renderHomeContent();
      case "history":
        return renderHistoryContent();
      case "profile":
        return <ProfileSection />;
      case "templates":
        return <TemplatesContent />;
      case "profiles":
        return <ProfilesContent />;
      case "scenarios":
        return <ScenariosContent />;
      case "template-list":
        return <Template mode="list" />;
      case "template-create":
        return <Template mode="create" />;
      case "student-management":
        return <StudentManagementContent />;
      case "manage-instructional":
        return <ManagementSection type="instructional" />;
      case "manage-instructors":
        return <ManagementSection type="instructors" />;
      case "manage-tas":
        return <ManagementSection type="tas" />;
      case "add-class":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Add New Class</h2>
              <p className="text-muted-foreground mt-2">
                Create a new class that you will be assigned to teach.
              </p>
            </div>
            <div className="max-w-2xl mx-auto">
              <div className="p-8 border rounded-lg bg-card">
                <p className="text-center text-muted-foreground">
                  Class creation form will be implemented here.
                </p>
              </div>
            </div>
          </div>
        );
      default:
        if (activeSection.startsWith("class-") && classData) {
          return <ClassDetailsContent classData={classData} />;
        }
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Select a section from the sidebar</p>
          </div>
        );
    }
  };

  const renderHomeContent = () => {
    if (effectiveRole === 'guest') {
      // Guest view - only templates
      return (
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Welcome to GLOW!
            </h2>
            <p className="text-muted-foreground">
              Click a template to get started.
            </p>
          </div>

          {/* Template Cards for Guest */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Dynamic Template Cards */}
            {templates?.map(template => {
              return (
                <Card
                  key={template.id}
                  className={`group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${loadingTemplate ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                  onClick={() => !loadingTemplate && handleStartTemplate(template.id)}
                >
                  <div className={`absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 opacity-30`}></div>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users
                        className={`h-5 w-5 text-blue-500 ${loadingTemplate === template.id ? "animate-spin" : "group-hover:scale-125 transition-transform duration-300"}`}
                      />
                      {template.title}
                    </CardTitle>
                    <CardDescription>Template</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      Interactive template with {template.chatTemplateIds.length} chat configuration{template.chatTemplateIds.length !== 1 ? 's' : ''}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      );
    }

    // Regular user view with Analytics for non-TA/guest users
    if (isLoading) {
      return (
        <div className="space-y-8">
          <div className="flex items-center justify-between space-y-2">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>

          {/* Skeleton for Template Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader>
                  <Skeleton className="h-6 w-32 mb-1" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-16 w-full" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-4 w-24" />
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Skeleton for Analytics/DataTable */}
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Template Section */}
        {effectiveRole == 'ta' && <div data-testid="template-section" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Template Cards - Only show if there are templates available */}
          {templatesLoading ? (
            // Loading skeletons for templates
            <Card className="overflow-hidden">
              <CardHeader>
                <Skeleton className="h-6 w-32 mb-1" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-4 w-24" />
              </CardFooter>
            </Card>
          ) : templates && templates.length > 0 ? (
            templates.map(template => {
              return (
                <Card
                  key={template.id}
                  data-testid="template-card"
                  className={`group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${loadingTemplate ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                  onClick={() => !loadingTemplate && handleStartTemplate(template.id)}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 opacity-30"></div>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users
                        className={`h-5 w-5 text-blue-500 ${loadingTemplate ? "animate-spin" : "group-hover:scale-110 transition-transform duration-300"}`}
                      />
                      Template
                    </CardTitle>
                    <CardDescription data-testid="template-class">Practice Session</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p data-testid="template-title" className="text-sm font-medium">{template.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {template.chatTemplateIds.length} chat configuration{template.chatTemplateIds.length !== 1 ? 's' : ''}
                    </p>
                  </CardContent>
                  <CardFooter className="text-xs text-muted-foreground flex justify-between items-center">
                    <div className="flex items-center" data-testid="template-duration">
                      <Timer className="h-3 w-3 mr-1" />
                      <span>{template.timeLimit} min</span>
                    </div>
                    <span className="font-medium">Click to start</span>
                  </CardFooter>
                </Card>
              );
            })
          ) : null}
        </div>}

        {/* Analytics Section - Show for non-TA and non-guest users */}
        {effectiveRole !== 'ta' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Analytics Overview</h2>
            </div>
            <Analytics />
          </div>
        )}
      </div>
    );
  };

  const renderHistoryContent = () => {
    return (
      <div className="space-y-6">
        <DataTable
          data={data || []}
          columns={columns}
          userOptions={userOptions}
          classOptions={classOptions}
          isAdmin={isAdmin}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </div>
    );
  };

  return (
    <SidebarProvider>
      <UnifiedSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />
      <SidebarInset>
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">{getPageTitle()}</h1>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-1 flex-col gap-4 p-4">
          {renderContent()}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
