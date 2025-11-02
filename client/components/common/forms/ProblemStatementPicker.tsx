/**
 * ProblemStatementPicker.tsx
 * Used to pick problem statements from version history or create new ones
 * Similar to PromptPicker component
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
import { ProblemStatementInfo } from "@/lib/api/v2/schemas/scenarios";
import { cn } from "@/lib/utils";

export interface ProblemStatementPickerProps extends PopoverProps {
  problemStatementMapping: Record<string, ProblemStatementInfo>;
  selectedProblemStatementId: string | null;
  onSelect: (problemStatementId: string | null) => void;
  onCreateNew: () => void;
  placeholder?: string;
  disabled?: boolean;
  buttonClassName?: string;
}

export function ProblemStatementPicker({
  problemStatementMapping,
  selectedProblemStatementId,
  onSelect,
  onCreateNew,
  placeholder = "Select problem statement version...",
  disabled = false,
  buttonClassName,
  ...props
}: ProblemStatementPickerProps) {
  const [open, setOpen] = React.useState(false);

  const problemStatements = React.useMemo(() => {
    // IDs from database are unique, so just convert mapping to array
    return Object.entries(problemStatementMapping).map(([id, info]) => ({
      id,
      ...info,
    }));
  }, [problemStatementMapping]);

  // Sort by updated_at descending (newest first), then by id for stable sort
  const sortedProblemStatements = React.useMemo(() => {
    return [...problemStatements].sort((a, b) => {
      const dateA = new Date(a.updated_at).getTime();
      const dateB = new Date(b.updated_at).getTime();
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      // If same timestamp, sort by ID for stable ordering
      return a.id.localeCompare(b.id);
    });
  }, [problemStatements]);

  const handleSelect = (problemStatementId: string) => {
    onSelect(problemStatementId);
    setOpen(false);
  };

  const handleCreateNew = () => {
    onCreateNew();
    setOpen(false);
  };

  const getButtonText = () => {
    if (!selectedProblemStatementId) {
      return "New Problem Statement";
    }
    const problemStatement =
      problemStatementMapping[selectedProblemStatementId];
    if (!problemStatement) {
      return placeholder;
    }
    const date = new Date(problemStatement.updated_at);
    return `Version ${date.toLocaleDateString()}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen} {...props}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select problem statement version"
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
            <CommandInput placeholder="Search problem statements..." />
            <CommandEmpty>No problem statements found.</CommandEmpty>
            <CommandGroup heading="Actions">
              <CommandItem value="__create_new__" onSelect={handleCreateNew}>
                <Plus className="mr-2 h-4 w-4" />
                Create New Problem Statement
              </CommandItem>
            </CommandGroup>
            {sortedProblemStatements.length > 0 && (
              <CommandGroup heading="Version History">
                {sortedProblemStatements.map((problemStatement) => {
                  const date = new Date(problemStatement.updated_at);
                  const isSelected =
                    selectedProblemStatementId === problemStatement.id;
                  return (
                    <CommandItem
                      key={problemStatement.id}
                      value={problemStatement.id}
                      onSelect={() => handleSelect(problemStatement.id)}
                      className="flex flex-col items-start py-3"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <Check
                            className={cn(
                              "h-4 w-4",
                              isSelected ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="font-medium">
                            {date.toLocaleDateString()}{" "}
                            {date.toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {problemStatement.problem_statement.substring(0, 100)}
                        {problemStatement.problem_statement.length > 100
                          ? "..."
                          : ""}
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
