/**
 * components/admin/unified-chat-content.tsx
 * Unified Chat management component with Templates, Profiles, and Scenarios
 */
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Timer, Users, FileText, Eye } from "lucide-react";

import { getTemplates } from "@/utils/queries/get-templates";
import { getProfiles } from "@/utils/queries/get-profiles";
import { getScenarios } from "@/utils/queries/get-scenarios";
import { deleteTemplate } from "@/utils/mutations/delete-template";
import { deleteProfile } from "@/utils/mutations/delete-profile";
import { deleteScenario } from "@/utils/mutations/delete-scenario";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function UnifiedChatContent() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("templates");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ type: string; id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch data for all three sections
  const { data: templates = [], refetch: refetchTemplates } = useQuery({
    queryKey: ["templates"],
    queryFn: () => getTemplates(),
  });

  const { data: profiles = [], refetch: refetchProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getProfiles(),
  });

  const { data: scenarios = [], refetch: refetchScenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getScenarios(),
  });

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      let result;
      switch (deleteItem.type) {
        case 'template':
          result = await deleteTemplate(deleteItem.id);
          break;
        case 'profile':
          result = await deleteProfile(deleteItem.id);
          break;
        case 'scenario':
          result = await deleteScenario(deleteItem.id);
          break;
        default:
          throw new Error('Invalid item type');
      }

      if (result.success) {
        toast.success(`${deleteItem.type.charAt(0).toUpperCase() + deleteItem.type.slice(1)} deleted successfully`);
        // Refetch the appropriate data
        switch (deleteItem.type) {
          case 'template':
            refetchTemplates();
            break;
          case 'profile':
            refetchProfiles();
            break;
          case 'scenario':
            refetchScenarios();
            break;
        }
      } else {
        toast.error(result.error || `Failed to delete ${deleteItem.type}`);
      }
    } catch (error) {
      console.error(`Error deleting ${deleteItem.type}:`, error);
      toast.error(`Failed to delete ${deleteItem.type}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDeleteClick = (type: string, id: string, name: string) => {
    setDeleteItem({ type, id, name });
    setShowDeleteDialog(true);
  };

  const handleEdit = (type: string, id: string) => {
    router.push(`/${type}/${id}`);
  };

  const renderTemplates = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Templates</h3>
          <p className="text-sm text-muted-foreground">Manage conversation templates</p>
        </div>
        <Button onClick={() => router.push('/template')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template: any) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-base">{template.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Timer className="h-3 w-3" />
                    {template.timeLimit} minutes
                  </CardDescription>
                </div>
                <Badge variant={template.active ? "default" : "secondary"}>
                  {template.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {template.chatTemplateIds?.length || 0} chat configurations
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  {template.documents?.length || 0} documents
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => handleEdit('template', template.id)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleDeleteClick('template', template.id, template.title)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
        
        {templates.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No templates found. Create your first template to get started.
          </div>
        )}
      </div>
    </div>
  );

  const renderProfiles = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Chat Profiles</h3>
          <p className="text-sm text-muted-foreground">Manage AI student personality profiles</p>
        </div>
        <Button onClick={() => router.push('/profile')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Profile
        </Button>
      </div>

      <div className="grid gap-4">
        {profiles.map((profile: any) => (
          <Card key={profile.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-base">{profile.name}</CardTitle>
                  <CardDescription>{profile.subtitle}</CardDescription>
                  <p className="text-sm text-muted-foreground">{profile.description}</p>
                </div>
                <div className="flex gap-2 items-center">
                  <Badge variant="outline">Threshold: {profile.threshold}%</Badge>
                  <Button variant="outline" size="sm" onClick={() => handleEdit('profile', profile.id)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDeleteClick('profile', profile.id, profile.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
        
        {profiles.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No profiles found. Create your first profile to get started.
          </div>
        )}
      </div>
    </div>
  );

  const renderScenarios = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Chat Scenarios</h3>
          <p className="text-sm text-muted-foreground">Manage conversation scenarios for AI students</p>
        </div>
        <Button onClick={() => router.push('/scenario')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Scenario
        </Button>
      </div>

      <div className="grid gap-4">
        {scenarios.map((scenario: any) => (
          <Card key={scenario.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-base">{scenario.name}</CardTitle>
                  <CardDescription>{scenario.description}</CardDescription>
                </div>
                <div className="flex gap-2 items-center">
                  <Button variant="outline" size="sm" onClick={() => handleEdit('scenario', scenario.id)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDeleteClick('scenario', scenario.id, scenario.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
        
        {scenarios.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No scenarios found. Create your first scenario to get started.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Chat Management</h2>
        <p className="text-muted-foreground">Manage templates, profiles, and scenarios</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
          <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
        </TabsList>
        
        <TabsContent value="templates" className="mt-6">
          {renderTemplates()}
        </TabsContent>
        
        <TabsContent value="profiles" className="mt-6">
          {renderProfiles()}
        </TabsContent>
        
        <TabsContent value="scenarios" className="mt-6">
          {renderScenarios()}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {deleteItem?.type} "{deleteItem?.name}". 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 