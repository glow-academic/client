/**
 * AgentRolePicker.tsx
 * Used to pick agent roles (agent_role enum)
 * Based on ReasoningPicker pattern
 * @AshokSaravanan222
 * 10/30/2025
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import { Check, ChevronsUpDown } from "lucide-react";
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

// Agent role enum values (from database schema)
export const AGENT_ROLES = [
  { id: "classify", name: "Classify", description: "Classification agent" },
  { id: "grade", name: "Grade", description: "Text-based grading agent" },
  {
    id: "audio",
    name: "Audio",
    description: "Audio-based grading agent",
  },
  { id: "hint", name: "Hint", description: "Hint generation agent" },
  {
    id: "scenario",
    name: "Scenario",
    description: "Scenario generation agent",
  },
  { id: "title", name: "Title", description: "Title generation agent" },
  { id: "image", name: "Image", description: "Image generation agent" },
  { id: "video", name: "Video", description: "Video generation agent" },
  {
    id: "simulation",
    name: "Simulation",
    description: "Text-based simulation agent",
  },
  {
    id: "voice",
    name: "Voice",
    description: "Voice-based simulation agent",
  },
  { id: "eval", name: "Eval", description: "Evaluation agent" },
  {
    id: "question",
    name: "Question",
    description: "Question generation agent",
  },
  {
    id: "document",
    name: "Document",
    description: "Document generation agent",
  },
  { id: "member", name: "Member", description: "Member agent" },
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number]["id"];

export interface RolePickerProps extends PopoverProps {
  selectedRole: string;
  onSelect: (role: string) => void;
  placeholder?: string;
  disabled?: boolean;
  buttonClassName?: string;
}

export function RolePicker({
  selectedRole,
  onSelect,
  placeholder = "Select role...",
  disabled = false,
  buttonClassName,
  ...props
}: RolePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (roleId: string) => {
    onSelect(roleId);
    setOpen(false);
  };

  const getButtonText = () => {
    if (!selectedRole) {
      return placeholder;
    }
    const role = AGENT_ROLES.find((r) => r.id === selectedRole);
    return role?.name || placeholder;
  };

  return (
    <Popover open={open} onOpenChange={setOpen} {...props}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select agent role"
          className={cn("w-full justify-between", buttonClassName)}
          disabled={disabled}
        >
          <span className="truncate text-left">{getButtonText()}</span>
          <ChevronsUpDown className="opacity-50 flex-shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] p-0">
        <Command loop>
          <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
            <CommandInput placeholder="Search roles..." />
            <CommandEmpty>No roles found.</CommandEmpty>
            <CommandGroup heading="Agent Roles">
              {AGENT_ROLES.map((role) => (
                <CommandItem
                  key={role.id}
                  onSelect={() => handleSelect(role.id)}
                  className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{role.name}</div>
                        {role.description && (
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {role.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <Check
                      className={cn(
                        "ml-auto flex-shrink-0",
                        selectedRole === role.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
