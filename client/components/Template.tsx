/**
 * Template.tsx
 * Used to create and manage templates for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Plus,
  Minus,
  Trash2,
  Edit,
  Eye,
  FileText,
  Clock,
  Users,
  Shuffle,
  X,
  Zap,
  Smile,
  HelpCircle,
  GripVertical,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DocumentViewer from "@/components/DocumentViewer";

// Queries and mutations
import { getClasses } from "@/utils/queries/get-classes";
import { getDocuments } from "@/utils/queries/get-documents";
import { getProfiles } from "@/utils/queries/get-profiles";
import { getTemplates } from "@/utils/queries/get-templates";
import { getTemplate } from "@/utils/queries/get-template";
import { createTemplate } from "@/utils/mutations/create-template";
import { updateTemplate } from "@/utils/mutations/update-template";
import { deleteTemplate } from "@/utils/mutations/delete-template";

interface ChatTemplateConfig {
  id: string;
  profileId: string;
  crowdedness: number;
  intensity: number;
  seniority: string;
}

interface TemplateComponentFormData {
  title: string;
  timeLimit: number;
  documents: string[];
  chatTemplateConfigs: ChatTemplateConfig[];
}

interface FormErrors {
  title?: string;
  timeLimit?: string;
  chatTemplates?: string;
}

interface TemplateProps {
  mode?: "list" | "create";
  templateId?: string;
}

export default function Template({ mode = "create", templateId }: TemplateProps) {
  const queryClient = useQueryClient();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<any>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const initialFormData: TemplateComponentFormData = {
    title: "",
    timeLimit: 15,
    documents: [],
    chatTemplateConfigs: [],
  };

  const [formData, setFormData] = useState<TemplateComponentFormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch classes, documents, profiles, and templates
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: getClasses,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: getDocuments,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: getProfiles,
  });

  // Fetch templates for the list mode
  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: getTemplates,
    enabled: mode === "list",
  });

  // Fetch specific template for editing
  const { data: templateToEdit } = useQuery({
    queryKey: ["template", templateId],
    queryFn: () => getTemplate(templateId!),
    enabled: !!templateId && mode === "create",
  });

  // Load template data when editing
  useEffect(() => {
    if (templateToEdit && templateId) {
      setEditingTemplateId(templateToEdit.id);
      setFormData({
        title: templateToEdit.title,
        timeLimit: templateToEdit.timeLimit,
        documents: templateToEdit.documents || [],
        chatTemplateConfigs: [], // We'll need to fetch chat templates separately
      });
      setErrors({});
    }
  }, [templateToEdit, templateId]);

  const handleInputChange = (field: keyof TemplateComponentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const addChatTemplate = () => {
    const newConfig: ChatTemplateConfig = {
      id: `temp-${Date.now()}`,
      profileId: profiles[0]?.id || "",
      crowdedness: 3,
      intensity: 3,
      seniority: "freshman",
    };
    setFormData(prev => ({
      ...prev,
      chatTemplateConfigs: [...prev.chatTemplateConfigs, newConfig]
    }));
  };

  const removeChatTemplate = (index: number) => {
    setFormData(prev => ({
      ...prev,
      chatTemplateConfigs: prev.chatTemplateConfigs.filter((_, i) => i !== index)
    }));
  };

  const updateChatTemplateConfig = (index: number, field: keyof ChatTemplateConfig, value: any) => {
    setFormData(prev => ({
      ...prev,
      chatTemplateConfigs: prev.chatTemplateConfigs.map((config, i) => 
        i === index ? { ...config, [field]: value } : config
      )
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    }

    if (formData.timeLimit < 1 || formData.timeLimit > 120) {
      newErrors.timeLimit = "Time limit must be between 1 and 120 minutes";
    }
    
    if (formData.chatTemplateConfigs.length === 0) {
      newErrors.chatTemplates = "At least one chat template must be configured";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setEditingTemplateId(null);
    setErrors({});
  };

  const handleEditTemplateClick = (templateId: string) => {
    const templateToEdit = templates.find((t: any) => t.id === templateId);
    if (templateToEdit) {
      setEditingTemplateId(templateToEdit.id);
      
      setFormData({
        title: templateToEdit.title,
        timeLimit: templateToEdit.timeLimit,
        documents: templateToEdit.documents || [],
        chatTemplateConfigs: [], // We'll need to fetch chat templates separately
      });
      setErrors({});
    }
  };
  
  const handleCancelEdit = () => {
    resetFormAndState();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      if (errors.chatTemplates) {
        toast.error(errors.chatTemplates);
      } else {
        toast.error("Please fill in all required fields");
      }
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // For now, we'll use existing chat template IDs from the database
      // In a full implementation, you'd create chat templates first
      const chatTemplateIds = formData.chatTemplateConfigs.map(config => config.id);

        const payload = {
        title: formData.title,
        timeLimit: formData.timeLimit,
        documents: formData.documents,
        chatTemplateIds: chatTemplateIds,
      };

      let result;
      if (editingTemplateId) {
        result = await updateTemplate(editingTemplateId, payload.title, payload.timeLimit, payload.documents, payload.chatTemplateIds, true);
      } else {
        result = await createTemplate(payload.title, payload.timeLimit, payload.documents, payload.chatTemplateIds);
      }
      
      if (result.success) {
        resetFormAndState();
        queryClient.invalidateQueries({ queryKey: ["templates"] });
        toast.success(editingTemplateId ? "Template updated successfully!" : "Template created successfully!");
      } else {
        toast.error(`Failed to ${editingTemplateId ? 'update' : 'create'} template: ${result.error}`);
      }
    } catch (error) {
      toast.error(`Failed to ${editingTemplateId ? 'update' : 'create'} template: ${error instanceof Error ? error.message : "Unknown error"}`);
      console.error(`Error ${editingTemplateId ? 'updating' : 'creating'} template:`, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;

    try {
      setIsDeleting(true);
      toast.loading("Deleting template...");

      const result = await deleteTemplate(templateToDelete);

      if (result.success) {
        // Refresh the template list
        queryClient.invalidateQueries({ queryKey: ["templates"] });
        
        toast.dismiss();
        toast.success("Template deleted successfully");
        setShowDeleteDialog(false);
        setTemplateToDelete(null);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.dismiss();
      toast.error(
        `Failed to delete template: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (mode === "list") {
    return (
      <div className="space-y-6">
        <div className="grid gap-4">
          {templates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No templates found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first template to get started with student interactions.
                </p>
              </CardContent>
            </Card>
          ) : (
            templates.map((template: any) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{template.title}</CardTitle>
                      <CardDescription>
                        <span className="inline-flex items-center text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 mr-1" />
                          {template.timeLimit} minutes
                        </span>
                        <span className="inline-flex items-center text-sm text-muted-foreground ml-4">
                          <Users className="h-4 w-4 mr-1" />
                          {template.chatTemplateIds?.length || 0} chat configurations
                        </span>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditTemplateClick(template.id)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTemplateToDelete(template.id);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Template</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this template? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteTemplate}
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

  // Create mode - render the full create form
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">
            {editingTemplateId ? "Edit Template" : "Create Template"}
          </h2>
          <p className="text-muted-foreground">
            {editingTemplateId ? "Update template settings and chat configurations" : "Set up a new template with AI student interactions"}
          </p>
        </div>
        {editingTemplateId && (
          <Button variant="outline" onClick={handleCancelEdit}>
            <X className="h-4 w-4 mr-2" />
            Cancel Edit
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Template Information */}
        <Card>
          <CardHeader>
            <CardTitle>Template Information</CardTitle>
            <CardDescription>
              Basic details about your template
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Template Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                placeholder="Enter template title"
                className={errors.title ? "border-destructive" : ""}
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
              <Input
                id="timeLimit"
                type="number"
                min="1"
                max="120"
                value={formData.timeLimit}
                onChange={(e) => handleInputChange("timeLimit", parseInt(e.target.value) || 0)}
                className={errors.timeLimit ? "border-destructive" : ""}
              />
              {errors.timeLimit && (
                <p className="text-sm text-destructive">{errors.timeLimit}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="documents">Reference Documents (Optional)</Label>
              <Select
                value={formData.documents[0] || "none"}
                onValueChange={(value) => handleInputChange("documents", value === "none" ? [] : [value])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select documents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No documents</SelectItem>
                  {documents.map((doc: any) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.documents.length > 0 && formData.documents[0] && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const doc = documents.find((d: any) => d.id === formData.documents[0]);
                    if (doc) {
                      setPreviewDocument(doc);
                      setShowDocumentModal(true);
                    }
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Document
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chat Template Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Chat Template Configuration</CardTitle>
            <CardDescription>
              Configure the AI student interactions for this template
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium">Chat Templates</h3>
                <p className="text-sm text-muted-foreground">
                  Add different AI student personalities and configurations
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={addChatTemplate}
                disabled={profiles.length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Chat Template
              </Button>
            </div>

            {errors.chatTemplates && (
              <p className="text-sm text-destructive">{errors.chatTemplates}</p>
            )}

            {formData.chatTemplateConfigs.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-center text-muted-foreground border border-dashed rounded-md p-4">
                <div>
                  <p className="text-red-500 font-medium mb-1">No chat templates configured</p>
                  <p className="text-sm">You must add at least one chat template to create a template</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {formData.chatTemplateConfigs.map((config, index) => (
                  <Card key={config.id} className="p-4">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">Chat Template {index + 1}</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeChatTemplate(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Profile</Label>
                          <Select
                            value={config.profileId}
                            onValueChange={(value) => updateChatTemplateConfig(index, "profileId", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a profile" />
                            </SelectTrigger>
                            <SelectContent>
                              {profiles.map((profile: any) => (
                                <SelectItem key={profile.id} value={profile.id}>
                                  {profile.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Seniority Level</Label>
                          <Select
                            value={config.seniority}
                            onValueChange={(value) => updateChatTemplateConfig(index, "seniority", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select seniority" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="freshman">Freshman</SelectItem>
                              <SelectItem value="sophomore">Sophomore</SelectItem>
                              <SelectItem value="junior">Junior</SelectItem>
                              <SelectItem value="senior">Senior</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Crowdedness (1-5)</Label>
                          <Slider
                            value={[config.crowdedness]}
                            onValueChange={(value) => updateChatTemplateConfig(index, "crowdedness", value[0])}
                            max={5}
                            min={1}
                            step={1}
                            className="w-full"
                          />
                          <div className="text-sm text-muted-foreground">
                            Current: {config.crowdedness}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Intensity (1-5)</Label>
                          <Slider
                            value={[config.intensity]}
                            onValueChange={(value) => updateChatTemplateConfig(index, "intensity", value[0])}
                            max={5}
                            min={1}
                            step={1}
                            className="w-full"
                          />
                          <div className="text-sm text-muted-foreground">
                            Current: {config.intensity}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {editingTemplateId ? "Updating..." : "Creating..."}
              </>
            ) : (
              editingTemplateId ? "Update Template" : "Create Template"
            )}
          </Button>
        </div>
      </form>

      {/* Document Preview Modal */}
      <Dialog open={showDocumentModal} onOpenChange={setShowDocumentModal}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Document Preview: {previewDocument?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewDocument && (
              <DocumentViewer document={previewDocument} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
