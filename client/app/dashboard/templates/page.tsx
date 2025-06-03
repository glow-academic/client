/**
 * app/dashboard/templates/page.tsx
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
import { getTemplates } from "@/utils/queries/get-templates";
import { getClasses } from "@/utils/queries/get-classes";
import { getUser } from "@/utils/queries/get-user";

type UserRole = 'admin' | 'instructional' | 'instructor' | 'ta' | 'guest'

export default function DashboardHomePage() {
  const router = useRouter();
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Handle client-side mounting
  useEffect(() => {
    setIsClient(true);
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

  // Fetch classes and templates
  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getClasses(),
  });

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => getTemplates(),
  });

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

  // Loading state
  if (templatesLoading) {
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
      </div>
    );
  }

  // Regular user view - now simplified without analytics
  return (
    <div className="space-y-6">
      <div data-testid="template-section" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates && templates.length > 0 ? (
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
      </div>
    </div>
  );
}
