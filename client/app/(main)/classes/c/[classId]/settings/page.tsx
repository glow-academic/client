"use client";
import React, { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { X, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

import { getClass } from "@/utils/queries/get-class";
import { getTemplates } from "@/utils/queries/get-templates";
import { updateClass } from "@/utils/mutations/update-class";
import { deleteClass } from "@/utils/mutations/delete-class";

interface FormData {
  name: string;
  classCode: string;
  year: number;
  term: 'fall' | 'spring' | 'summer';
  description: string;
  templateIds: string[];
}

interface FormErrors {
  name?: string;
  classCode?: string;
  year?: string;
  term?: string;
  description?: string;
  templateIds?: string;
}

export default function SettingsPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    classCode: "",
    year: new Date().getFullYear(),
    term: 'fall',
    description: "",
    templateIds: [],
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch class data
  const { data: classData, isLoading: classLoading } = useQuery({
    queryKey: ["class", classId],
    queryFn: () => getClass(classId),
    enabled: !!classId,
  });

  // Fetch templates for selection
  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: () => getTemplates(),
  });

  // Update form data when class data is loaded
  React.useEffect(() => {
    if (classData) {
      setFormData({
        name: classData.name || "",
        classCode: classData.classCode || "",
        year: classData.year || new Date().getFullYear(),
        term: classData.term || 'fall',
        description: classData.description || "",
        templateIds: classData.templateIds || [],
      });
    }
  }, [classData]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Class name is required";
    }

    if (!formData.classCode.trim()) {
      newErrors.classCode = "Class code is required";
    }

    if (formData.year < 2020 || formData.year > 2030) {
      newErrors.year = "Year must be between 2020 and 2030";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }

    if (formData.templateIds.length === 0) {
      newErrors.templateIds = "At least one template must be selected";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const result = await updateClass(
        classId,
        formData.name,
        formData.classCode,
        formData.year,
        formData.term,
        formData.description,
        formData.templateIds
      );
      
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["classes"] });
        queryClient.invalidateQueries({ queryKey: ["class", classId] });
        toast.success("Class updated successfully!");
        router.push(`/classes/c/${classId}`);
      } else {
        toast.error(`Failed to update class: ${result.error}`);
      }
    } catch (error) {
      toast.error(`Failed to update class: ${error instanceof Error ? error.message : "Unknown error"}`);
      console.error("Error updating class:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    
    try {
      const result = await deleteClass(classId);
      
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["classes"] });
        toast.success("Class deleted successfully!");
        router.push('/classes/general');
      } else {
        toast.error(`Failed to delete class: ${result.error}`);
      }
    } catch (error) {
      toast.error(`Failed to delete class: ${error instanceof Error ? error.message : "Unknown error"}`);
      console.error("Error deleting class:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTemplateToggle = (templateId: string) => {
    setFormData(prev => ({
      ...prev,
      templateIds: prev.templateIds.includes(templateId)
        ? prev.templateIds.filter(id => id !== templateId)
        : [...prev.templateIds, templateId]
    }));
  };

  const removeTemplate = (templateId: string) => {
    setFormData(prev => ({
      ...prev,
      templateIds: prev.templateIds.filter(id => id !== templateId)
    }));
  };

  const selectedTemplates = templates.filter(template => 
    formData.templateIds.includes(template.id)
  );

  if (classLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <Skeleton className="h-8 w-64 mx-auto mb-2" />
          <Skeleton className="h-4 w-96 mx-auto" />
        </div>
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-6">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Class Not Found</h1>
          <p className="text-muted-foreground mt-2">
            The requested class could not be found.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Edit Class</h1>
        <p className="text-muted-foreground mt-2">
          Update class information, templates, and configuration
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Class Information</CardTitle>
            <CardDescription>
              Update the information for {classData.classCode}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <CardContent className="space-y-6">
              {/* Class Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Class Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Introduction to Computer Science"
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name}</p>
                )}
              </div>

              {/* Class Code */}
              <div className="space-y-2">
                <Label htmlFor="classCode">Class Code *</Label>
                <Input
                  id="classCode"
                  value={formData.classCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, classCode: e.target.value }))}
                  placeholder="e.g., CS101"
                  className={errors.classCode ? "border-red-500" : ""}
                />
                {errors.classCode && (
                  <p className="text-sm text-red-500">{errors.classCode}</p>
                )}
              </div>

              {/* Year and Term */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="year">Year *</Label>
                  <Input
                    id="year"
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) || new Date().getFullYear() }))}
                    min="2020"
                    max="2030"
                    className={errors.year ? "border-red-500" : ""}
                  />
                  {errors.year && (
                    <p className="text-sm text-red-500">{errors.year}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="term">Term *</Label>
                  <Select
                    value={formData.term}
                    onValueChange={(value: 'fall' | 'spring' | 'summer') => 
                      setFormData(prev => ({ ...prev, term: value }))
                    }
                  >
                    <SelectTrigger className={errors.term ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select term" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fall">Fall</SelectItem>
                      <SelectItem value="spring">Spring</SelectItem>
                      <SelectItem value="summer">Summer</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.term && (
                    <p className="text-sm text-red-500">{errors.term}</p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the class objectives, topics covered, and any other relevant information..."
                  rows={4}
                  className={errors.description ? "border-red-500" : ""}
                />
                {errors.description && (
                  <p className="text-sm text-red-500">{errors.description}</p>
                )}
              </div>

              {/* Template Selection */}
              <div className="space-y-4">
                <div>
                  <Label>Templates *</Label>
                  <p className="text-sm text-muted-foreground">
                    Select the templates that will be available for this class
                  </p>
                </div>

                {/* Selected Templates */}
                {selectedTemplates.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm">Selected Templates:</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplates.map((template) => (
                        <Badge key={template.id} variant="secondary" className="flex items-center gap-1">
                          {template.title}
                          <button
                            type="button"
                            onClick={() => removeTemplate(template.id)}
                            className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Template Selection */}
                <div className="space-y-2">
                  <Label className="text-sm">Available Templates:</Label>
                  <ScrollArea className="h-48 border rounded-md p-4">
                    <div className="space-y-3">
                      {templates.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No templates available. Create templates first.
                        </p>
                      ) : (
                        templates.map((template) => (
                          <div key={template.id} className="flex items-start space-x-3">
                            <Checkbox
                              id={`template-${template.id}`}
                              checked={formData.templateIds.includes(template.id)}
                              onCheckedChange={() => handleTemplateToggle(template.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <Label
                                htmlFor={`template-${template.id}`}
                                className="text-sm font-medium cursor-pointer"
                              >
                                {template.title}
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {template.timeLimit} minutes • {template.documents?.length || 0} documents
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {errors.templateIds && (
                  <p className="text-sm text-red-500">{errors.templateIds}</p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex justify-between">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/classes/c/${classId}`)}
                  disabled={isSubmitting || isDeleting}
                >
                  Cancel
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={isSubmitting || isDeleting}
                    >
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
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? "Deleting..." : "Delete Class"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              
              <Button type="submit" disabled={isSubmitting || isDeleting}>
                {isSubmitting ? "Updating..." : "Update Class"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
