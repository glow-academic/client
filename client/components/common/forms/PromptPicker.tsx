/**
 * PromptPicker.tsx
 * Used to pick prompts from version history or create new ones
 * @AshokSaravanan222
 * 01/20/2025
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

export interface PromptInfo {
  system_prompt: string;
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
  onSelect: (promptId: string | null) => void;
  onCreateNew: () => void;
  placeholder?: string;
  disabled?: boolean;
  buttonClassName?: string;
  triggerProps?: TriggerButtonProps;
}

export function PromptPicker({
  promptMapping,
  selectedPromptId,
  onSelect,
  onCreateNew,
  placeholder = "Select prompt version...",
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

  const handleCreateNew = () => {
    onCreateNew();
    setOpen(false);
  };

  const getButtonText = () => {
    if (!selectedPromptId) {
      return "New Prompt";
    }
    const prompt = promptMapping[selectedPromptId];
    if (!prompt) {
      return placeholder;
    }
    const date = new Date(prompt.updated_at);
    return `Version ${date.toLocaleDateString()}`;
  };

  const { className: triggerClassName, ...restTriggerProps } =
    triggerProps ?? {};

  const buttonClasses = cn("justify-between", buttonClassName, triggerClassName);

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
          <span className="truncate">{getButtonText()}</span>
          <ChevronsUpDown className="opacity-50 flex-shrink-0 ml-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[400px] p-0">
        <Command loop>
          <CommandList className="max-h-[300px]">
            <CommandInput placeholder="Search prompts..." />
            <CommandEmpty>No prompts found.</CommandEmpty>
            <CommandGroup heading="Actions">
              <CommandItem onSelect={handleCreateNew}>
                <Plus className="mr-2 h-4 w-4" />
                Create New Prompt
              </CommandItem>
            </CommandGroup>
            {sortedPrompts.length > 0 && (
              <CommandGroup heading="Version History">
                {sortedPrompts.map((prompt) => {
                  const date = new Date(prompt.updated_at);
                  const isSelected = selectedPromptId === prompt.id;
                  return (
                    <CommandItem
                      key={prompt.id}
                      onSelect={() => handleSelect(prompt.id)}
                      className="flex flex-col items-start py-3"
                      data-testid="prompt-option"
                      data-prompt-id={prompt.id}
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
                        </div>
                      </div>
                      {prompt.department_ids &&
                        prompt.department_ids.length > 0 && (
                          <span className="text-xs text-muted-foreground mt-1">
                            {prompt.department_ids.length} department
                            {prompt.department_ids.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      <span className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {prompt.system_prompt.substring(0, 100)}
                        {prompt.system_prompt.length > 100 ? "..." : ""}
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
