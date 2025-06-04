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
import { Timer, Users, User, Frown, Smile, HelpCircle } from "lucide-react";

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
      if (!classes) {
        toast.error("No classes found. Please contact an administrator.");
        return;
      }

      setLoadingTemplate(templateId);
      toast.loading("Starting template...");

      // For guests, use all available classes; for users, use their assigned classes or all if none assigned
      const availableClasses = effectiveRole === 'guest'
        ? classes
        : (user?.classIds.length > 0 ? classes.filter(c => user.classIds.includes(c.id)) : classes);

      const classId = availableClasses.length > 0
        ? availableClasses[Math.floor(Math.random() * availableClasses.length)].id
        : classes[Math.floor(Math.random() * classes.length)].id;

      const formData = new FormData();
      formData.append("template_id", templateId);
      
      // Handle user_id for guest mode
      if (effectiveRole === 'guest' || !user) {
        formData.append("user_id", ""); // Send empty string for guest mode
      } else {
        formData.append("user_id", user.id);
      }
      
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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || response.statusText || "Failed to start template");
      }
    } catch (error) {
      console.error("Error starting template:", error);
      toast.dismiss();
      toast.error("Failed to start template. Please try again.");
    } finally {
      setLoadingTemplate(null);
    }
  };

  // Define permanent templates
  const permanentTemplates = [
    {
      id: 'aaaaaaaa-1111-2222-3333-444444444444',
      title: 'Aggressive Student Practice',
      icon: Frown,
      color: 'from-red-500 to-red-600',
      accentColor: 'red',
      description: 'Practice with challenging and direct students',
      chatCount: 1
    },
    {
      id: 'bbbbbbbb-1111-2222-3333-444444444444',
      title: 'Happy Student Practice',
      icon: Smile,
      color: 'from-emerald-500 to-emerald-600',
      accentColor: 'emerald',
      description: 'Practice with positive and encouraging students',
      chatCount: 1
    },
    {
      id: 'cccccccc-1111-2222-3333-444444444444',
      title: 'Confused Student Practice',
      icon: HelpCircle,
      color: 'from-amber-500 to-amber-600',
      accentColor: 'amber',
      description: 'Practice with students who need clarification',
      chatCount: 1
    }
  ];

  if (effectiveRole === 'guest') {
    // Guest view - permanent templates + dynamic templates
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

        {/* Permanent Template Cards for Guest */}
        <div>
          <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">Solo Chat</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {permanentTemplates.map(template => {
              const IconComponent = template.icon;
              return (
                <Card
                  key={template.id}
                  className={`group relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 ${loadingTemplate ? "cursor-not-allowed opacity-70" : "cursor-pointer"} bg-white dark:bg-gray-900 border-0 shadow-lg`}
                  onClick={() => !loadingTemplate && handleStartTemplate(template.id)}
                >
                  {/* Background Pattern */}
                  <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-600"></div>
                    <div className="absolute inset-0" style={{
                      backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
                      backgroundSize: '20px 20px'
                    }}></div>
                  </div>
                  
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${template.color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <IconComponent className="h-6 w-6 text-white" />
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Solo</div>
                        <div className="text-xs text-gray-400">Chat</div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
                        {template.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                        {template.description}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <Timer className="h-3 w-3 mr-1" />
                        <span className="text-sm">∞</span>
                        <span className="ml-1">min</span>
                      </div>
                      <div className="flex items-center">
                        <User className="h-3 w-3 mr-1" />
                        <span>1 session</span>
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="pt-0">
                    <div className={`w-full text-center py-3 rounded-lg bg-gradient-to-r ${template.color} text-white font-medium text-sm group-hover:shadow-lg transition-all duration-300 ${loadingTemplate === template.id ? 'animate-pulse' : ''}`}>
                      {loadingTemplate === template.id ? 'Starting...' : 'Start Chat'}
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Dynamic Template Cards */}
        {templates && templates.length > 0 && (
          <>
            <div className="border-t pt-8">
              <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">Multi Chats</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {templates.map(template => {
                  return (
                    <Card
                      key={template.id}
                      className={`group relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 ${loadingTemplate ? "cursor-not-allowed opacity-70" : "cursor-pointer"} bg-white dark:bg-gray-900 border-0 shadow-lg`}
                      onClick={() => !loadingTemplate && handleStartTemplate(template.id)}
                    >
                      {/* Background Pattern */}
                      <div className="absolute inset-0 opacity-5">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-purple-600"></div>
                        <div className="absolute inset-0" style={{
                          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
                          backgroundSize: '20px 20px'
                        }}></div>
                      </div>
                      
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg group-hover:scale-110 transition-transform duration-300">
                            <Users className="h-6 w-6 text-white" />
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Multi</div>
                            <div className="text-xs text-gray-400">Chats</div>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        <div>
                          <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
                            {template.title}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                            Interactive template with {template.chatTemplateIds.length} chat configuration{template.chatTemplateIds.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                          <div className="flex items-center">
                            <Timer className="h-3 w-3 mr-1" />
                            <span>{template.timeLimit} min</span>
                          </div>
                          <div className="flex items-center">
                            <Users className="h-3 w-3 mr-1" />
                            <span>{template.chatTemplateIds.length} session{template.chatTemplateIds.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </CardContent>
                      
                      <CardFooter className="pt-0">
                        <div className={`w-full text-center py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium text-sm group-hover:shadow-lg transition-all duration-300 ${loadingTemplate === template.id ? 'animate-pulse' : ''}`}>
                          {loadingTemplate === template.id ? 'Starting...' : 'Start Chats'}
                        </div>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            </div>
          </>
        )}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden bg-white dark:bg-gray-900 border-0 shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="text-right space-y-1">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Skeleton className="h-10 w-full rounded-lg" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Regular user view - permanent templates + dynamic templates
  return (
    <div className="space-y-8">
      {/* Permanent Template Cards */}
      <div>
        <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">Solo Chat</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {permanentTemplates.map(template => {
            const IconComponent = template.icon;
            return (
              <Card
                key={template.id}
                data-testid="permanent-template-card"
                className={`group relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 ${loadingTemplate ? "cursor-not-allowed opacity-70" : "cursor-pointer"} bg-white dark:bg-gray-900 border-0 shadow-lg`}
                onClick={() => !loadingTemplate && handleStartTemplate(template.id)}
              >
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-600"></div>
                  <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
                    backgroundSize: '20px 20px'
                  }}></div>
                </div>
                
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${template.color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <IconComponent className="h-6 w-6 text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400" data-testid="template-type">Solo</div>
                      <div className="text-xs text-gray-400">Chat</div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" data-testid="template-title">
                      {template.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                      {template.description}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center" data-testid="template-duration">
                      <Timer className="h-3 w-3 mr-1" />
                      <span className="text-sm">∞</span>
                      <span className="ml-1">min</span>
                    </div>
                    <div className="flex items-center">
                      <User className="h-3 w-3 mr-1" />
                      <span>1 session</span>
                    </div>
                  </div>
                </CardContent>
                
                <CardFooter className="pt-0">
                  <div className={`w-full text-center py-3 rounded-lg bg-gradient-to-r ${template.color} text-white font-medium text-sm group-hover:shadow-lg transition-all duration-300 ${loadingTemplate === template.id ? 'animate-pulse' : ''}`}>
                    {loadingTemplate === template.id ? 'Starting...' : 'Start Chat'}
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Dynamic Template Cards */}
      {templates && templates.length > 0 && (
        <div className="border-t pt-8">
          <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">Multi Chats</h3>
          <div data-testid="template-section" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map(template => {
              return (
                <Card
                  key={template.id}
                  data-testid="template-card"
                  className={`group relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 ${loadingTemplate ? "cursor-not-allowed opacity-70" : "cursor-pointer"} bg-white dark:bg-gray-900 border-0 shadow-lg`}
                  onClick={() => !loadingTemplate && handleStartTemplate(template.id)}
                >
                  {/* Background Pattern */}
                  <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-purple-600"></div>
                    <div className="absolute inset-0" style={{
                      backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
                      backgroundSize: '20px 20px'
                    }}></div>
                  </div>
                  
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <Users className="h-6 w-6 text-white" />
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400" data-testid="template-class">Multi</div>
                        <div className="text-xs text-gray-400">Chats</div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" data-testid="template-title">
                        {template.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                        Interactive template with {template.chatTemplateIds.length} chat configuration{template.chatTemplateIds.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center" data-testid="template-duration">
                        <Timer className="h-3 w-3 mr-1" />
                        <span>{template.timeLimit} min</span>
                      </div>
                      <div className="flex items-center">
                        <Users className="h-3 w-3 mr-1" />
                        <span>{template.chatTemplateIds.length} session{template.chatTemplateIds.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="pt-0">
                    <div className={`w-full text-center py-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium text-sm group-hover:shadow-lg transition-all duration-300 ${loadingTemplate === template.id ? 'animate-pulse' : ''}`}>
                      {loadingTemplate === template.id ? 'Starting...' : 'Start Chats'}
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
