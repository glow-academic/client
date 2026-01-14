/**
 * SchemaOutput.tsx
 * Component for editing return template Jinja content
 * Follows Names.tsx / Descriptions.tsx pattern - manages own state, calls save actions directly
 */

"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateTemplateIn = InputOf<"/api/v4/resources/templates", "post">;
type CreateTemplateOut = OutputOf<"/api/v4/resources/templates", "post">;
type CreateSchemaFieldIn = InputOf<"/api/v4/resources/schema_fields", "post">;
type CreateSchemaFieldOut = OutputOf<"/api/v4/resources/schema_fields", "post">;

export interface TemplateDetail {
  template_id: string;
  name: string;
  schema_id: string;
  generated: boolean;
}

export interface SchemaFieldDetail {
  schema_field_id: string;
  schema_id: string;
  name: string;
  field_type: string;
  required: boolean;
  description: string;
  template: string;
  position: number;
  default_value: string;
  generated: boolean;
}

export interface Domain {
  domain_id: string;
  resource: string;
  generated: boolean;
}

export interface SchemaOutputProps {
  template_ids: string[]; // From Tool.tsx formState - which templates are selected
  output_templates: TemplateDetail[]; // From API - detailed template data for selected templates
  output_schema_fields: SchemaFieldDetail[]; // From API - schema_fields from schemas linked to selected templates (these have Jinja templates)
  input_schema_fields: SchemaFieldDetail[]; // From API - for Jinja variable autocomplete/reference
  domain_resources: Domain[]; // From API - domain connections for context (read-only)
  disabled: boolean; // Based on can_edit flag from Tool.tsx
  // Note: template_ids selection is managed by Tool.tsx in separate "templates" step
  // This component only edits templates within selected templates
  createTemplateAction?: (
    input: CreateTemplateIn
  ) => Promise<CreateTemplateOut>;
  createSchemaFieldAction?: (
    input: CreateSchemaFieldIn
  ) => Promise<CreateSchemaFieldOut>;
  group_id?: string | null; // Group ID for resource creation
  agent_id?: string | null; // Agent ID for resource creation
  // Component handles template changes internally and calls save actions
  // No onChange callback needed - component manages its own state like Names/Descriptions
}

export function SchemaOutput({
  template_ids,
  output_templates,
  output_schema_fields,
  input_schema_fields,
  domain_resources,
  disabled = false,
  createTemplateAction,
  createSchemaFieldAction,
  group_id,
  agent_id,
}: SchemaOutputProps) {
  // Get available Jinja variables from input schema fields
  const availableVariables = useMemo(() => {
    return input_schema_fields.map((field) => field.name);
  }, [input_schema_fields]);

  // Group output schema fields by template (via schema_id)
  const fieldsByTemplate = useMemo(() => {
    const grouped: Record<string, SchemaFieldDetail[]> = {};
    output_templates.forEach((template) => {
      const fields = output_schema_fields.filter(
        (field) => field.schema_id === template.schema_id
      );
      if (fields.length > 0) {
        grouped[template.template_id] = fields.sort(
          (a, b) => a.position - b.position
        );
      }
    });
    return grouped;
  }, [output_templates, output_schema_fields]);

  // Internal state for template field templates (Jinja content)
  const [fieldTemplates, setFieldTemplates] = useState<Record<string, string>>(
    {}
  );
  const templateDebounceTimerRef = useRef<Record<string, NodeJS.Timeout>>({});
  const lastSavedTemplatesRef = useRef<Record<string, string>>({});
  const isTemplateInitialMountRef = useRef(true);

  // Initialize field templates from props
  useEffect(() => {
    if (isTemplateInitialMountRef.current) {
      const initialTemplates: Record<string, string> = {};
      output_schema_fields.forEach((field) => {
        initialTemplates[field.schema_field_id] = field.template;
      });
      setFieldTemplates(initialTemplates);
      lastSavedTemplatesRef.current = initialTemplates;
      isTemplateInitialMountRef.current = false;
    }
  }, [output_schema_fields]);

  // Sync field templates when props change
  useEffect(() => {
    const newTemplates: Record<string, string> = {};
    output_schema_fields.forEach((field) => {
      const currentTemplate = fieldTemplates[field.schema_field_id];
      if (!currentTemplate || currentTemplate !== field.template) {
        newTemplates[field.schema_field_id] = field.template;
      } else {
        newTemplates[field.schema_field_id] = currentTemplate;
      }
    });
    if (Object.keys(newTemplates).length > 0) {
      setFieldTemplates(newTemplates);
      lastSavedTemplatesRef.current = newTemplates;
    }
  }, [output_schema_fields, fieldTemplates]);

  // Debounced save function for field templates (creates new schema_field resource)
  const saveFieldTemplate = useCallback(
    async (fieldId: string, template: string) => {
      if (!createSchemaFieldAction || !agent_id || !group_id) return;

      const field = output_schema_fields.find(
        (f) => f.schema_field_id === fieldId
      );
      if (!field) return;

      try {
        // Create new schema_field resource with updated template (write-only pattern)
        await createSchemaFieldAction({
          body: {
            agent_id: agent_id,
            group_id: group_id,
            schema_id: field.schema_id,
            name: field.name,
            field_type: field.field_type as
              | "string"
              | "number"
              | "boolean"
              | "array",
            required: field.required,
            position_value: field.position,
            template: template,
            description: field.description,
            default_value: field.default_value,
            mcp: false,
          },
        });
        lastSavedTemplatesRef.current[fieldId] = template;
      } catch (error) {
        console.error("Failed to create schema field:", error);
      }
    },
    [createSchemaFieldAction, output_schema_fields, agent_id, group_id]
  );

  // Handle field template change with debouncing
  const handleFieldTemplateChange = useCallback(
    (fieldId: string, template: string) => {
      setFieldTemplates((prev) => ({
        ...prev,
        [fieldId]: template,
      }));

      // Clear existing timer for this field
      if (templateDebounceTimerRef.current[fieldId]) {
        clearTimeout(templateDebounceTimerRef.current[fieldId]);
      }

      // Set new timer (500ms debounce like Names.tsx)
      templateDebounceTimerRef.current[fieldId] = setTimeout(() => {
        const lastSaved = lastSavedTemplatesRef.current[fieldId];
        // Only save if value actually changed
        if (!lastSaved || lastSaved !== template) {
          saveFieldTemplate(fieldId, template);
        }
      }, 500);
    },
    [saveFieldTemplate]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(templateDebounceTimerRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  // Internal state for template names (like Names.tsx internalValue)
  const [templateNames, setTemplateNames] = useState<Record<string, string>>(
    {}
  );
  const debounceTimerRef = useRef<Record<string, NodeJS.Timeout>>({});
  const lastSavedNamesRef = useRef<Record<string, string>>({});
  const isInitialMountRef = useRef(true);

  // Initialize template names from props
  useEffect(() => {
    if (isInitialMountRef.current) {
      const initialNames: Record<string, string> = {};
      output_templates.forEach((template) => {
        initialNames[template.template_id] = template.name;
      });
      setTemplateNames(initialNames);
      lastSavedNamesRef.current = initialNames;
      isInitialMountRef.current = false;
    }
  }, [output_templates]);

  // Sync template names when props change (like Names.tsx syncs with resourceName)
  useEffect(() => {
    const newNames: Record<string, string> = {};
    output_templates.forEach((template) => {
      const currentName = templateNames[template.template_id];
      if (!currentName || currentName !== template.name) {
        newNames[template.template_id] = template.name;
      } else {
        newNames[template.template_id] = currentName;
      }
    });
    if (Object.keys(newNames).length > 0) {
      setTemplateNames(newNames);
      lastSavedNamesRef.current = newNames;
    }
  }, [output_templates, templateNames]);

  // Debounced save function for template name (creates new template resource)
  const saveTemplateName = useCallback(
    async (templateId: string, name: string) => {
      if (!createTemplateAction || !agent_id || !group_id) return;

      try {
        // Create new template resource with updated name (write-only pattern)
        await createTemplateAction({
          body: {
            agent_id: agent_id,
            group_id: group_id,
            name: name,
            mcp: false,
          },
        });
        lastSavedNamesRef.current[templateId] = name;
        // Note: The new template will be created, old one remains
        // Tool.tsx manages which template_ids are selected
      } catch (error) {
        console.error("Failed to create template:", error);
      }
    },
    [createTemplateAction, agent_id, group_id]
  );

  // Handle template name change with debouncing
  const handleTemplateNameChange = useCallback(
    (templateId: string, name: string) => {
      setTemplateNames((prev) => ({
        ...prev,
        [templateId]: name,
      }));

      // Clear existing timer for this template
      if (debounceTimerRef.current[templateId]) {
        clearTimeout(debounceTimerRef.current[templateId]);
      }

      // Set new timer (500ms debounce like Names.tsx)
      debounceTimerRef.current[templateId] = setTimeout(() => {
        const lastSaved = lastSavedNamesRef.current[templateId];
        // Only save if value actually changed
        if (!lastSaved || lastSaved !== name) {
          saveTemplateName(templateId, name);
        }
      }, 500);
    },
    [saveTemplateName]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimerRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  // Don't render if no templates selected
  if (template_ids.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No templates selected. Select templates in the "Templates" step to edit
        them.
      </div>
    );
  }

  // Don't render if no templates
  if (output_templates.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No template details found for selected templates.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Domain connections display (read-only) */}
      {domain_resources.length > 0 && (
        <div className="rounded-md border p-4 bg-muted/50">
          <Label className="text-sm font-medium mb-2">Domain Connections</Label>
          <div className="flex flex-wrap gap-2">
            {domain_resources.map((domain) => (
              <span
                key={domain.domain_id}
                className="text-xs px-2 py-1 rounded bg-background border"
              >
                {domain.resource}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Available variables reference */}
      {availableVariables.length > 0 && (
        <div className="rounded-md border p-4 bg-muted/50">
          <Label className="text-sm font-medium mb-2">
            Available Jinja Variables (from Input Schema)
          </Label>
          <div className="flex flex-wrap gap-2">
            {availableVariables.map((variable) => (
              <code
                key={variable}
                className="text-xs px-2 py-1 rounded bg-background border"
              >
                {`{{ ${variable} }}`}
              </code>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Use these variables in template fields below. Variables reference
            input schema field names.
          </p>
        </div>
      )}

      {/* Templates list with their schema fields */}
      {output_templates.map((template) => {
        const templateName =
          templateNames[template.template_id] ?? template.name;
        const fields = fieldsByTemplate[template.template_id] ?? [];
        return (
          <div
            key={template.template_id}
            className="border rounded-md p-4 space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor={`${template.template_id}-name`}>
                Template Name
              </Label>
              <Input
                id={`${template.template_id}-name`}
                value={templateName}
                onChange={(e) =>
                  handleTemplateNameChange(template.template_id, e.target.value)
                }
                disabled={disabled}
                placeholder="Template name"
              />
            </div>

            {/* Schema fields with Jinja templates */}
            {fields.length > 0 ? (
              <div className="space-y-3">
                <Label className="text-sm font-semibold">
                  Output Schema Fields (Jinja Templates)
                </Label>
                {fields.map((field) => {
                  const fieldTemplate =
                    fieldTemplates[field.schema_field_id] ?? field.template;
                  return (
                    <div
                      key={field.schema_field_id}
                      className="border rounded p-3 space-y-2 bg-muted/30"
                    >
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">
                          {field.name} ({field.field_type})
                        </Label>
                        {field.required && (
                          <span className="text-xs text-destructive">
                            Required
                          </span>
                        )}
                      </div>
                      {field.description && (
                        <p className="text-xs text-muted-foreground">
                          {field.description}
                        </p>
                      )}
                      <Textarea
                        value={fieldTemplate}
                        onChange={(e) =>
                          handleFieldTemplateChange(
                            field.schema_field_id,
                            e.target.value
                          )
                        }
                        disabled={disabled}
                        placeholder={`{{ ${field.name} }}`}
                        rows={3}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Jinja template that transforms input arguments into this
                        field's value. Use variables from input schema:{" "}
                        {availableVariables
                          .slice(0, 5)
                          .map((v) => `{{ ${v} }}`)
                          .join(", ")}
                        {availableVariables.length > 5 && "..."}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No schema fields found for this template. The template may not
                be linked to a schema yet.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
