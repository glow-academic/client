/**
 * Template.tsx
 * Used to create and manage templates for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import React, { useState, useEffect } from "react";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Plus,
  Trash2,
  Edit,
  Eye,
  FileText,
  Clock,
  Users,
  Shuffle,
  GripVertical,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import DocumentViewer from "@/components/DocumentViewer";
import { templates as Templates } from "@/drizzle/schema";
import { chatTemplates as ChatTemplates } from "@/drizzle/schema";
import { documents as Documents } from "@/drizzle/schema";
import { profiles as Profiles } from "@/drizzle/schema";

// Queries and mutations
import { getDocuments } from "@/utils/queries/get-documents";
import { getProfiles } from "@/utils/queries/get-profiles";
import { getTemplates } from "@/utils/queries/get-templates";
import { getTemplate } from "@/utils/queries/get-template";
import { createTemplate } from "@/utils/mutations/create-template";
import { updateTemplate } from "@/utils/mutations/update-template";
import { deleteTemplate } from "@/utils/mutations/delete-template";
import { getChatTemplates } from "@/utils/queries/get-chat-templates";
import { createChatTemplate } from "@/utils/mutations/create-chat-template";
import { updateChatTemplate } from "@/utils/mutations/update-chat-template";

interface ChatTemplateConfig {
  id: string;
  profileId: string;
  crowdedness: number;
  intensity: number;
  seniority: string;
  isNew?: boolean; // Track if this is a new template that needs to be created
}

interface TemplateComponentFormData {
  title: string;
  timeLimit: number | null;
  documents: string[];
  chatTemplateConfigs: ChatTemplateConfig[];
  active: boolean;
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

// Preset configurations for quick setup
const CHAT_TEMPLATE_PRESETS = [
  {
    name: "Balanced Classroom",
    description: "A mix of engaged and confused students",
    configs: [
      { profileId: "", crowdedness: 3, intensity: 2, seniority: "sophomore" },
      { profileId: "", crowdedness: 4, intensity: 3, seniority: "junior" },
      { profileId: "", crowdedness: 2, intensity: 4, seniority: "freshman" },
    ]
  },
  {
    name: "High Energy Session",
    description: "Active and engaged students",
    configs: [
      { profileId: "", crowdedness: 4, intensity: 4, seniority: "junior" },
      { profileId: "", crowdedness: 5, intensity: 3, seniority: "senior" },
      { profileId: "", crowdedness: 3, intensity: 5, seniority: "sophomore" },
    ]
  },
  {
    name: "Quiet Study Group",
    description: "Focused, low-intensity environment",
    configs: [
      { profileId: "", crowdedness: 2, intensity: 2, seniority: "senior" },
      { profileId: "", crowdedness: 1, intensity: 1, seniority: "junior" },
    ]
  },
  {
    name: "Mixed Experience",
    description: "Students from all levels",
    configs: [
      { profileId: "", crowdedness: 3, intensity: 3, seniority: "freshman" },
      { profileId: "", crowdedness: 3, intensity: 3, seniority: "sophomore" },
      { profileId: "", crowdedness: 3, intensity: 3, seniority: "junior" },
      { profileId: "", crowdedness: 3, intensity: 3, seniority: "senior" },
    ]
  }
];

export default function Template({ mode = "create", templateId }: TemplateProps) {
  const queryClient = useQueryClient();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<typeof Documents.$inferSelect | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [draggedCard, setDraggedCard] = useState<ChatTemplateConfig | null>(null);

  const initialFormData: TemplateComponentFormData = {
    title: "",
    timeLimit: 15,
    documents: [],
    chatTemplateConfigs: [],
    active: true,
  };

  const [formData, setFormData] = useState<TemplateComponentFormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

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

  const { data: chatTemplates = [] } = useQuery({
    queryKey: ["chatTemplates"],
    queryFn: getChatTemplates,
  });

  // Fetch specific template for editing
  const { data: templateToEdit } = useQuery({
    queryKey: ["template", templateId],
    queryFn: () => getTemplate(templateId!),
    enabled: !!templateId && mode === "create",
  });

  // Load template data when editing
  useEffect(() => {
    if (templateToEdit && templateId && chatTemplates.length > 0) {
      setEditingTemplateId(templateToEdit.id);
      
      // Map existing chat template IDs to full chat template objects
      const existingChatTemplateConfigs = templateToEdit.chatTemplateIds
        ?.map((id: string) => {
          const chatTemplate = chatTemplates.find((t: typeof ChatTemplates.$inferSelect) => t.id === id);
          return chatTemplate ? {
            id: chatTemplate.id,
            profileId: chatTemplate.profileId,
            crowdedness: chatTemplate.crowdedness,
            intensity: chatTemplate.intensity,
            seniority: chatTemplate.seniority,
            isNew: false,
          } : null;
        })
        .filter(Boolean) || [];

      setFormData({
        title: templateToEdit.title,
        timeLimit: templateToEdit.timeLimit,
        documents: templateToEdit.documents || [],
        chatTemplateConfigs: existingChatTemplateConfigs as ChatTemplateConfig[],
        active: templateToEdit.active ?? true,
      });
      setErrors({});
    }
  }, [templateToEdit, templateId, chatTemplates]);

  const handleInputChange = (field: keyof TemplateComponentFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const addChatTemplate = () => {
    if (profiles.length === 0) {
      toast.error("No profiles available. Please create profiles first.");
      return;
    }

    const newConfig: ChatTemplateConfig = {
      id: `temp-${Date.now()}`,
      profileId: profiles[0]?.id || "",
      crowdedness: 3,
      intensity: 3,
      seniority: "freshman",
      isNew: true,
    };
    setFormData(prev => ({
      ...prev,
      chatTemplateConfigs: [...prev.chatTemplateConfigs, newConfig]
    }));
  };

  const addPresetChatTemplates = (preset: typeof CHAT_TEMPLATE_PRESETS[0]) => {
    if (profiles.length === 0) {
      toast.error("No profiles available. Please create profiles first.");
      return;
    }

    const defaultProfileId = profiles[0]?.id || "";
    const newConfigs: ChatTemplateConfig[] = preset.configs.map((config, index) => ({
      id: `temp-${Date.now()}-${index}`,
      profileId: config.profileId || defaultProfileId,
      crowdedness: config.crowdedness,
      intensity: config.intensity,
      seniority: config.seniority,
      isNew: true,
    }));

    setFormData(prev => ({
      ...prev,
      chatTemplateConfigs: [...prev.chatTemplateConfigs, ...newConfigs]
    }));

    toast.success(`Added ${preset.name} preset with ${newConfigs.length} chat templates!`);
  };

  const removeChatTemplate = (index: number) => {
    setFormData(prev => ({
      ...prev,
      chatTemplateConfigs: prev.chatTemplateConfigs.filter((_, i) => i !== index)
    }));
  };

  const updateChatTemplateConfig = (index: number, field: keyof ChatTemplateConfig, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      chatTemplateConfigs: prev.chatTemplateConfigs.map((config, i) => 
        i === index ? { ...config, [field]: value } : config
      )
    }));
  };

  const randomizeCards = () => {
    const shuffled = [...formData.chatTemplateConfigs].sort(() => Math.random() - 0.5);
    setFormData(prev => ({ ...prev, chatTemplateConfigs: shuffled }));
    toast.success("Chat templates randomized!");
  };

  const handleDragStart = (e: React.DragEvent, config: ChatTemplateConfig) => {
    setDraggedCard(config);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetConfig: ChatTemplateConfig) => {
    e.preventDefault();
    
    if (!draggedCard) return;

    const newOrder = [...formData.chatTemplateConfigs];
    const draggedIndex = newOrder.findIndex(config => config.id === draggedCard.id);
    const targetIndex = newOrder.findIndex(config => config.id === targetConfig.id);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, removed);
      
      setFormData(prev => ({ ...prev, chatTemplateConfigs: newOrder }));
    }
    
    setDraggedCard(null);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    }

    if (formData.timeLimit && (formData.timeLimit < 1 || formData.timeLimit > 120)) {
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
    const templateToEdit = templates.find((t: typeof Templates.$inferSelect) => t.id === templateId);
    if (templateToEdit) {
      setEditingTemplateId(templateToEdit.id);
      
      // Map existing chat template IDs to full chat template objects
      const existingChatTemplateConfigs = templateToEdit.chatTemplateIds
        ?.map((id: string) => {
          const chatTemplate = chatTemplates.find((t: typeof ChatTemplates.$inferSelect) => t.id === id);
          return chatTemplate ? {
            id: chatTemplate.id,
            profileId: chatTemplate.profileId,
            crowdedness: chatTemplate.crowdedness,
            intensity: chatTemplate.intensity,
            seniority: chatTemplate.seniority,
            isNew: false,
          } : null;
        })
        .filter(Boolean) || [];

      setFormData({
        title: templateToEdit.title,
        timeLimit: templateToEdit.timeLimit,
        documents: templateToEdit.documents || [],
        chatTemplateConfigs: existingChatTemplateConfigs as ChatTemplateConfig[],
        active: templateToEdit.active ?? true,
      });
      setErrors({});
    }
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
      // First, create any new chat templates
      const chatTemplateIds: string[] = [];
      
      for (const config of formData.chatTemplateConfigs) {
        if (config.isNew) {
          // Create new chat template
          const result = await createChatTemplate(
            config.profileId,
            config.crowdedness,
            config.intensity,
            config.seniority as "freshman" | "sophomore" | "junior" | "senior"
          );
          
          if (result.success && result.chatTemplate) {
            chatTemplateIds.push(result.chatTemplate.id);
          } else {
            throw new Error(`Failed to create chat template: ${result.error}`);
          }
        } else {
          // Use existing chat template ID
          chatTemplateIds.push(config.id);
          
          // Update existing chat template if needed
          await updateChatTemplate(
            config.id,
            config.profileId,
            config.crowdedness,
            config.intensity,
            config.seniority as "freshman" | "sophomore" | "junior" | "senior"
          );
        }
      }

      const payload = {
        title: formData.title,
        timeLimit: formData.timeLimit,
        documents: formData.documents,
        chatTemplateIds: chatTemplateIds,
      };

      let result;
      if (editingTemplateId) {
        result = await updateTemplate(editingTemplateId, payload.title, payload.timeLimit, payload.documents, payload.chatTemplateIds, formData.active);
      } else {
        result = await createTemplate(payload.title, payload.timeLimit, payload.documents, payload.chatTemplateIds);
        // Set active status after creation if needed
        if (result.success && result.template && !formData.active) {
          await updateTemplate(result.template.id, undefined, undefined, undefined, undefined, formData.active);
        }
      }
      
      if (result.success) {
        resetFormAndState();
        queryClient.invalidateQueries({ queryKey: ["templates"] });
        queryClient.invalidateQueries({ queryKey: ["chatTemplates"] });
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
            templates.map((template: typeof Templates.$inferSelect) => (
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
                      <Badge variant={template.active ? "default" : "secondary"}>
                        {template.active ? "Active" : "Inactive"}
                      </Badge>
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
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Template Information */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Template Information</CardTitle>
                <CardDescription>
                  Basic details about your template
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Label htmlFor="active-toggle" className="text-sm font-medium">
                  {formData.active ? "Active" : "Inactive"}
                </Label>
                <Switch
                  id="active-toggle"
                  checked={formData.active}
                  onCheckedChange={(checked: boolean) => handleInputChange("active", checked)}
                />
              </div>
            </div>
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
                value={formData.timeLimit || ""}
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
                onValueChange={(value: string) => handleInputChange("documents", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select documents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No documents</SelectItem>
                  {documents.map((doc: typeof Documents.$inferSelect) => (
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
                    const doc = documents.find((d: typeof Documents.$inferSelect) => d.id === formData.documents[0]);
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
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Chat Template Configuration</CardTitle>
                <CardDescription>
                  Configure the AI student interactions for this template
                </CardDescription>
              </div>
              {formData.chatTemplateConfigs.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={randomizeCards}
                  className="flex items-center gap-2"
                >
                  <Shuffle className="h-4 w-4" />
                  Randomize
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium">Chat Templates</h3>
                <p className="text-sm text-muted-foreground">
                  Add different AI student personalities and configurations
                </p>
              </div>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={profiles.length === 0}
                      className="flex items-center gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      Presets
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium">Quick Setup Presets</h4>
                        <p className="text-sm text-muted-foreground">
                          Choose a preset to quickly add multiple chat templates
                        </p>
                      </div>
                      <div className="space-y-2">
                        {CHAT_TEMPLATE_PRESETS.map((preset, index) => (
                          <div
                            key={index}
                            className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => addPresetChatTemplates(preset)}
                          >
                            <div className="font-medium text-sm">{preset.name}</div>
                            <div className="text-xs text-muted-foreground">{preset.description}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {preset.configs.length} templates
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
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
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {formData.chatTemplateConfigs.map((config, index) => {
                  return (
                    <Card 
                      key={config.id} 
                      className={`p-3 cursor-move hover:shadow-md transition-all border-l-4 ${
                        config.isNew ? 'border-l-green-500' : 'border-l-blue-500'
                      } ${draggedCard?.id === config.id ? 'opacity-50' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, config)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, config)}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium">Chat Template {index + 1}</span>
                            {config.isNew && (
                              <Badge variant="secondary" className="text-xs">New</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">#{index + 1}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeChatTemplate(index)}
                              className="h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs">Profile</Label>
                            <Select
                              value={config.profileId}
                              onValueChange={(value) => updateChatTemplateConfig(index, "profileId", value)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select profile" />
                              </SelectTrigger>
                              <SelectContent>
                                {profiles.map((profile: typeof Profiles.$inferSelect) => (
                                  <SelectItem key={profile.id} value={profile.id}>
                                    {profile.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-xs">Seniority</Label>
                            <Select
                              value={config.seniority}
                              onValueChange={(value) => updateChatTemplateConfig(index, "seniority", value)}
                            >
                              <SelectTrigger className="h-8">
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

                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <Label className="text-xs">Crowdedness</Label>
                              <span className="text-xs text-muted-foreground">
                                {config.crowdedness === 1 ? "Empty" : 
                                 config.crowdedness === 2 ? "Sparse" :
                                 config.crowdedness === 3 ? "Moderate" :
                                 config.crowdedness === 4 ? "Busy" : "Crowded"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              {[1, 2, 3, 4, 5].map(level => (
                                <button
                                  key={level}
                                  type="button"
                                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                                    level === config.crowdedness 
                                      ? 'bg-blue-500 border-blue-500' 
                                      : 'border-gray-300 hover:border-blue-300'
                                  }`}
                                  onClick={() => updateChatTemplateConfig(index, 'crowdedness', level)}
                                />
                              ))}
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <Label className="text-xs">Intensity</Label>
                              <span className="text-xs text-muted-foreground">
                                {config.intensity === 1 ? "Low" : 
                                 config.intensity === 2 ? "Mild" :
                                 config.intensity === 3 ? "Moderate" :
                                 config.intensity === 4 ? "High" : "Very High"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              {[1, 2, 3, 4, 5].map(level => (
                                <button
                                  key={level}
                                  type="button"
                                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                                    level === config.intensity 
                                      ? 'bg-orange-500 border-orange-500' 
                                      : 'border-gray-300 hover:border-orange-300'
                                  }`}
                                  onClick={() => updateChatTemplateConfig(index, 'intensity', level)}
                                />
                              ))}
                            </div>
                          </div>

                          <Badge className={`text-xs ${
                            config.seniority === 'freshman' ? 'bg-blue-100 text-blue-800' :
                            config.seniority === 'sophomore' ? 'bg-green-100 text-green-800' :
                            config.seniority === 'junior' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {config.seniority.charAt(0).toUpperCase() + config.seniority.slice(1)}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  );
                })}
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
