/**
 * app/dashboard/chats/page.tsx
 * This is the unified home page with role-based access control
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Timer, Users, User } from "lucide-react";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getClasses } from "@/utils/queries/get-classes";
import { getUser } from "@/utils/queries/get-user";
import { getProfileConfig } from "@/utils/profiles";
import { getTemplates } from "@/utils/queries/get-templates";
import { getChatTemplates } from "@/utils/queries/get-chat-templates";
import { getProfiles } from "@/utils/queries/get-profiles";
import { useRole } from "@/components/role-context";

export default function DashboardHomePage() {
  const router = useRouter();
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);
  
  // Use the role context instead of local state
  const { effectiveRole } = useRole();

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser(),
  });

  // Fetch classes and templates
  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getClasses(),
  });
  
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => getTemplates(),
  });

  const { data: chatTemplates } = useQuery({
    queryKey: ["chatTemplates"],
    queryFn: () => getChatTemplates(),
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getProfiles(),
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
        : (user?.classIds?.length || 0 > 0 ? classes.filter(c => user?.classIds.includes(c.id)) : classes);

      const classId = availableClasses.length > 0
        ? availableClasses[Math.floor(Math.random() * availableClasses.length)].id
        : classes[Math.floor(Math.random() * classes.length)].id;

      const formData = new FormData();
      formData.append("template_id", templateId);
      
      // Handle user_id for guest mode
      if (effectiveRole === 'guest' || !user) {
        // pass
      } else {
        formData.append("user_id", user.id);
      }
      
      formData.append("class_id", classId);
      
      // Add test_data flag if running in test environment
      if (typeof window !== 'undefined' && (window as any).Cypress) {
        formData.append("test_data", "true");
      }

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

  // Helper function to get chat template details with profile info
  const getChatTemplateWithProfile = (chatTemplateId: string) => {
    const chatTemplate = chatTemplates?.find(ct => ct.id === chatTemplateId);
    if (!chatTemplate) return null;
    
    const profile = profiles?.find(p => p.id === chatTemplate.profileId);
    return {
      ...chatTemplate,
      profile
    };
  };

  // Separate templates into solo and multi based on chat template count
  const soloTemplates = templates?.filter(template => {
    const validChatTemplateIds = template.chatTemplateIds?.filter(id => id !== "RAY") || [];
    return validChatTemplateIds.length === 1;
  }) || [];

  const multiTemplates = templates?.filter(template => {
    const validChatTemplateIds = template.chatTemplateIds?.filter(id => id !== "RAY") || [];
    return validChatTemplateIds.length > 1;
  }) || [];

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

  if (effectiveRole === 'guest') {
    // Guest view - show all templates
    return (
      <div className="space-y-8">
        {/* Solo Chat Templates */}
        {soloTemplates.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">Solo Chat</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {soloTemplates.map(template => {
                const validChatTemplateIds = template.chatTemplateIds?.filter(id => id !== "RAY") || [];
                const chatTemplateWithProfile = getChatTemplateWithProfile(validChatTemplateIds[0]);
                const profileName = chatTemplateWithProfile?.profile?.name || 'general';
                const profileConfig = getProfileConfig(profileName);
                const IconComponent = profileConfig.icon;

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
                        <div className={`p-3 rounded-xl bg-gradient-to-br ${profileConfig.colors.gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
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
                          {profileConfig.description}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center">
                          <Timer className="h-3 w-3 mr-1" />
                          <span className="text-sm">{template.timeLimit ? `${template.timeLimit}` : '∞'}</span>
                          <span className="ml-1">min</span>
                        </div>
                        <div className="flex items-center">
                          <User className="h-3 w-3 mr-1" />
                          <span>1 session</span>
                        </div>
                      </div>
                    </CardContent>
                    
                    <CardFooter className="pt-0">
                      <div className={`w-full text-center py-3 rounded-lg bg-gradient-to-r ${profileConfig.colors.gradient} text-white font-medium text-sm group-hover:shadow-lg transition-all duration-300 ${loadingTemplate === template.id ? 'animate-pulse' : ''}`}>
                        {loadingTemplate === template.id ? 'Starting...' : 'Start Chat'}
                      </div>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Multi Chat Templates */}
        {multiTemplates.length > 0 && (
          <div className={soloTemplates.length > 0 ? "border-t pt-8" : ""}>
            <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">Multi Chats</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {multiTemplates.map(template => {
                const validChatTemplateIds = template.chatTemplateIds?.filter(id => id !== "RAY") || [];
                
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
                          Interactive template with {validChatTemplateIds.length} chat configuration{validChatTemplateIds.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center">
                          <Timer className="h-3 w-3 mr-1" />
                          <span>{template.timeLimit ? `${template.timeLimit}` : '∞'} min</span>
                        </div>
                        <div className="flex items-center">
                          <Users className="h-3 w-3 mr-1" />
                          <span>{validChatTemplateIds.length} session{validChatTemplateIds.length !== 1 ? 's' : ''}</span>
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

        {/* No templates message */}
        {soloTemplates.length === 0 && multiTemplates.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold mb-2">No templates available</h3>
            <p className="text-muted-foreground">Contact an administrator to add templates.</p>
          </div>
        )}
      </div>
    );
  }

  // Regular user view - show all templates
  return (
    <div className="space-y-8">
      {/* Solo Chat Templates */}
      {soloTemplates.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">Solo Chat</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {soloTemplates.map(template => {
              const validChatTemplateIds = template.chatTemplateIds?.filter(id => id !== "RAY") || [];
              const chatTemplateWithProfile = getChatTemplateWithProfile(validChatTemplateIds[0]);
              const profileName = chatTemplateWithProfile?.profile?.name || 'general';
              const profileConfig = getProfileConfig(profileName);
              const IconComponent = profileConfig.icon;

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
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${profileConfig.colors.gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
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
                        {profileConfig.description}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center" data-testid="template-duration">
                        <Timer className="h-3 w-3 mr-1" />
                        <span className="text-sm">{template.timeLimit ? `${template.timeLimit}` : '∞'}</span>
                        <span className="ml-1">min</span>
                      </div>
                      <div className="flex items-center">
                        <User className="h-3 w-3 mr-1" />
                        <span>1 session</span>
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="pt-0">
                    <div className={`w-full text-center py-3 rounded-lg bg-gradient-to-r ${profileConfig.colors.gradient} text-white font-medium text-sm group-hover:shadow-lg transition-all duration-300 ${loadingTemplate === template.id ? 'animate-pulse' : ''}`}>
                      {loadingTemplate === template.id ? 'Starting...' : 'Start Chat'}
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Multi Chat Templates */}
      {multiTemplates.length > 0 && (
        <div className={soloTemplates.length > 0 ? "border-t pt-8" : ""}>
          <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">Multi Chats</h3>
          <div data-testid="template-section" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {multiTemplates.map(template => {
              const validChatTemplateIds = template.chatTemplateIds?.filter(id => id !== "RAY") || [];
              
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
                        Interactive template with {validChatTemplateIds.length} chat configuration{validChatTemplateIds.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center" data-testid="template-duration">
                        <Timer className="h-3 w-3 mr-1" />
                        <span>{template.timeLimit ? `${template.timeLimit}` : '∞'} min</span>
                      </div>
                      <div className="flex items-center">
                        <Users className="h-3 w-3 mr-1" />
                        <span>{validChatTemplateIds.length} session{validChatTemplateIds.length !== 1 ? 's' : ''}</span>
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

      {/* No templates message */}
      {soloTemplates.length === 0 && multiTemplates.length === 0 && (
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">No templates available</h3>
          <p className="text-muted-foreground">Contact an administrator to add templates.</p>
        </div>
      )}
    </div>
  );
}
