/**
 * TemplatePicker.tsx
 * Used to pick templates from version history or create new ones
 * Similar to ProblemStatementPicker component
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type TemplateInfo = {
  template_args: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export interface TemplatePickerProps extends PopoverProps {
  templateMapping: Record<string, TemplateInfo>;
  selectedTemplateId: string | null;
  onSelect: (templateId: string | null) => void;
  onCreateNew: () => void;
  placeholder?: string;
  disabled?: boolean;
  buttonClassName?: string;
}

export function TemplatePicker({
  templateMapping,
  selectedTemplateId,
  onSelect,
  onCreateNew,
  placeholder = "Select template version...",
  disabled = false,
  buttonClassName,
  ...props
}: TemplatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const templates = React.useMemo(() => {
    // IDs from database are unique, so just convert mapping to array
    return Object.entries(templateMapping).map(([id, info]) => ({
      id,
      ...info,
    }));
  }, [templateMapping]);

  // Sort by updated_at descending (newest first), then by id for stable sort
  const sortedTemplates = React.useMemo(() => {
    return [...templates].sort((a, b) => {
      const dateA = new Date(a.updated_at).getTime();
      const dateB = new Date(b.updated_at).getTime();
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      // If same timestamp, sort by ID for stable ordering
      return a.id.localeCompare(b.id);
    });
  }, [templates]);

  const handleSelect = (templateId: string) => {
    onSelect(templateId);
    setOpen(false);
  };

  const handleCreateNew = () => {
    onCreateNew();
    setOpen(false);
  };

  const getButtonText = () => {
    if (!selectedTemplateId) {
      return "New Template";
    }
    const template = templateMapping[selectedTemplateId];
    if (!template) {
      return placeholder;
    }
    const date = new Date(template.updated_at);
    return `Version ${date.toLocaleDateString()}`;
  };

  const getTemplatePreview = (template: TemplateInfo) => {
    // Try to get template name from schema if available
    const schema = template.template_args;
    if (schema && typeof schema === "object" && "name" in schema) {
      return String(schema.name);
    }
    return "Template";
  };

  return (
    <Popover open={open} onOpenChange={setOpen} {...props}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select template version"
          className={cn("justify-between", buttonClassName)}
          disabled={disabled}
        >
          <span className="truncate">{getButtonText()}</span>
          <ChevronsUpDown className="opacity-50 flex-shrink-0 ml-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[400px] p-0">
        <Command loop>
          <CommandList className="max-h-[300px]">
            <CommandInput placeholder="Search templates..." />
            <CommandEmpty>No templates found.</CommandEmpty>
            <CommandGroup heading="Actions">
              <CommandItem value="__create_new__" onSelect={handleCreateNew}>
                <Plus className="mr-2 h-4 w-4" />
                Create New Template
              </CommandItem>
            </CommandGroup>
            {sortedTemplates.length > 0 && (
              <CommandGroup heading="Version History">
                {sortedTemplates.map((template) => {
                  const date = new Date(template.updated_at);
                  const isSelected = selectedTemplateId === template.id;
                  const preview = getTemplatePreview(template);
                  return (
                    <CommandItem
                      key={template.id}
                      value={template.id}
                      onSelect={() => handleSelect(template.id)}
                      className="flex flex-col items-start py-3"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <Check
                            className={cn(
                              "h-4 w-4",
                              isSelected ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="font-medium">
                            {date.toLocaleDateString()}{" "}
                            {date.toLocaleTimeString()}
                          </span>
                          {template.active && (
                            <span className="text-xs text-muted-foreground">
                              (Active)
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground mt-1">
                        {preview}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

