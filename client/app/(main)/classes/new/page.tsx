"use client";
import React, { useState } from "react";
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
import { X } from "lucide-react";

import { getTemplates } from "@/utils/queries/get-templates";
import { createClass } from "@/utils/mutations/create-class";

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

export default function NewClassPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    classCode: "",
    year: new Date().getFullYear(),
    term: 'fall',
    description: "",
    templateIds: [],
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch templates for selection
  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: () => getTemplates(),
  });

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
      const result = await createClass(
        formData.name,
        formData.classCode,
        formData.year,
        formData.term,
        formData.description,
        formData.templateIds
      );
      
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["classes"] });
        toast.success("Class created successfully!");
        router.push('/classes/general');
      } else {
        toast.error(`Failed to create class: ${result.error}`);
      }
    } catch (error) {
      toast.error(`Failed to create class: ${error instanceof Error ? error.message : "Unknown error"}`);
      console.error("Error creating class:", error);
    } finally {
      setIsSubmitting(false);
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

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Create New Class</h1>
        <p className="text-muted-foreground mt-2">
          Set up a new class with templates and configuration
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Class Information</CardTitle>
            <CardDescription>
              Enter the basic information for your new class
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
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/classes/general')}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Class"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
