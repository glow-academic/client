/**
 * PromptPicker.tsx
 * Used to pick prompts from version history or create new ones
 * @AshokSaravanan222
 * 01/20/2025
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export interface PromptInfo {
  system_prompt: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  department_ids: string[] | null;
  can_delete: boolean;
}

type TriggerButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "data-testid"
> & {
  "data-testid"?: string;
};

export interface PromptPickerProps extends PopoverProps {
  promptMapping: Record<string, PromptInfo>;
  selectedPromptId: string | null;
  defaultPromptId: string | null; // ID of the default prompt for this persona
  onSelect: (promptId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  buttonClassName?: string;
  triggerProps?: TriggerButtonProps;
}

export function PromptPicker({
  promptMapping,
  selectedPromptId,
  defaultPromptId,
  onSelect,
  placeholder = "Select prompt...",
  disabled = false,
  buttonClassName,
  triggerProps,
  ...props
}: PromptPickerProps) {
  const [open, setOpen] = React.useState(false);

  const prompts = React.useMemo(() => {
    return Object.entries(promptMapping).map(([id, info]) => ({
      id,
      ...info,
    }));
  }, [promptMapping]);

  // Sort by updated_at descending (newest first)
  const sortedPrompts = React.useMemo(() => {
    return [...prompts].sort((a, b) => {
      const dateA = new Date(a.updated_at).getTime();
      const dateB = new Date(b.updated_at).getTime();
      return dateB - dateA;
    });
  }, [prompts]);

  const handleSelect = (promptId: string) => {
    onSelect(promptId);
    setOpen(false);
  };

  const getButtonText = () => {
    if (!selectedPromptId) {
      return placeholder;
    }
    const prompt = promptMapping[selectedPromptId];
    if (!prompt) {
      return placeholder;
    }
    return prompt.name || placeholder;
  };

  const isSelectedDefault = selectedPromptId === defaultPromptId;

  const { className: triggerClassName, ...restTriggerProps } =
    triggerProps ?? {};

  const buttonClasses = cn(
    "justify-between",
    buttonClassName,
    triggerClassName,
  );

  return (
    <Popover open={open} onOpenChange={setOpen} {...props}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select prompt version"
          className={buttonClasses}
          disabled={disabled}
          {...restTriggerProps}
        >
          <div className="flex items-center gap-2 truncate">
            {isSelectedDefault && (
              <Badge
                variant="secondary"
                className="text-xs h-5 px-1.5 flex-shrink-0"
              >
                Default
              </Badge>
            )}
            <span className="truncate">{getButtonText()}</span>
          </div>
          <ChevronsUpDown className="opacity-50 flex-shrink-0 ml-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[400px] p-0">
        <Command loop>
          <CommandList className="max-h-[300px]">
            <CommandInput placeholder="Search prompts..." />
            <CommandEmpty>No prompts found.</CommandEmpty>
            {sortedPrompts.length > 0 && (
              <CommandGroup heading="Prompts">
                {sortedPrompts.map((prompt) => {
                  const isSelected = selectedPromptId === prompt.id;
                  const isDefault =
                    prompt.id === defaultPromptId ||
                    !prompt.department_ids ||
                    prompt.department_ids.length === 0;
                  return (
                    <CommandItem
                      key={prompt.id}
                      onSelect={() => handleSelect(prompt.id)}
                      className="group data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
                      data-testid="prompt-option"
                      data-prompt-id={prompt.id}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {isDefault && (
                              <Badge
                                variant="secondary"
                                className="text-xs h-5 px-1.5"
                              >
                                Default
                              </Badge>
                            )}
                            <div className="font-medium truncate">
                              {prompt.name || "Unnamed Prompt"}
                            </div>
                          </div>
                          {prompt.description && (
                            <div className="text-sm text-muted-foreground truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                              {prompt.description}
                            </div>
                          )}
                          {prompt.department_ids &&
                            prompt.department_ids.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {prompt.department_ids.length} department
                                {prompt.department_ids.length !== 1 ? "s" : ""}
                              </div>
                            )}
                        </div>
                        <Check
                          className={cn(
                            "ml-auto flex-shrink-0 group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                        />
                      </div>
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
