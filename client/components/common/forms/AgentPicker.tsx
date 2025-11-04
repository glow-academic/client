/**
 * AgentPicker.tsx
 * Used to pick agents for department configuration
 * Based on RubricPicker pattern with role-based filtering
 * @AshokSaravanan222 & @siladiea
 * 10/25/2025
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, X } from "lucide-react";
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
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMutationObserver } from "@/hooks/use-mutation-observer";
import { cn } from "@/lib/utils";

type AgentMappingItem = {
  name: string;
  description: string;
  roles: string[];
};

export interface AgentPickerProps extends PopoverProps {
  mapping: Record<string, AgentMappingItem>;
  validIds: string[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  multiSelect?: boolean;
  placeholder?: string;
  hideSelectedChips?: boolean;
  buttonClassName?: string;
  disabled?: boolean;
}

export function AgentPicker({
  mapping,
  validIds,
  selectedIds,
  onSelect,
  multiSelect = false,
  placeholder = "Select agents...",
  hideSelectedChips = true,
  buttonClassName,
  disabled = false,
  ...props
}: AgentPickerProps) {
  const [open, setOpen] = React.useState(false);

  // Build agents from mapping
  const agents = React.useMemo(() => {
    return validIds
      .map((id) => {
        const item = mapping[id];
        if (!item) return null;
        return {
          id,
          ...item,
        };
      })
      .filter((a): a is { id: string } & AgentMappingItem => a !== null);
  }, [validIds, mapping]);

  const [peekedAgent, setPeekedAgent] = React.useState<
    ({ id: string } & AgentMappingItem) | undefined
  >(agents[0]);

  const handleSelect = (agentId: string) => {
    if (multiSelect) {
      const isSelected = selectedIds.includes(agentId);
      const newIds = isSelected
        ? selectedIds.filter((id) => id !== agentId)
        : [...selectedIds, agentId];
      onSelect(newIds);
      // Don't close popover in multi-select mode
    } else {
      onSelect([agentId]);
      setOpen(false);
    }
  };

  // Allow clearing selection
  const handleClear = () => {
    onSelect([]);
    setOpen(false);
  };

  // Remove individual item
  const handleRemoveItem = (agentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIds = selectedIds.filter((id) => id !== agentId);
    onSelect(newIds);
  };

  const getButtonText = () => {
    if (selectedIds.length === 0) {
      return placeholder;
    }
    if (selectedIds.length === 1) {
      const agent = mapping[selectedIds[0]!];
      return agent?.name || placeholder;
    }
    return `${selectedIds.length} agents selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No agents found.`;
  };

  return (
    <div>
      {/* Show selected items */}
      {selectedIds.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedIds.map((id) => {
            const agent = mapping[id];
            if (!agent) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm max-w-full"
              >
                <span className="truncate">{agent.name}</span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveItem(id, e)}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen} {...props}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select agents"
            className={cn("w-full justify-between", buttonClassName)}
            size="sm"
            disabled={disabled}
          >
            <span className="truncate text-left">{getButtonText()}</span>
            <ChevronsUpDown className="opacity-50 flex-shrink-0 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[300px] p-0">
          <HoverCard>
            <HoverCardContent
              side="left"
              align="start"
              forceMount
              className="min-h-[200px]"
            >
              <div className="grid gap-2">
                <h4 className="font-medium leading-none">
                  {peekedAgent?.name || "No agent selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedAgent?.description || "No description available"}
                </div>
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[250px]">
                <CommandInput placeholder="Search agents..." />
                <CommandEmpty>{getSearchNotFoundMessage()}</CommandEmpty>
                <HoverCardTrigger />
                {selectedIds.length > 0 && (
                  <CommandGroup heading="Actions">
                    <CommandItem
                      onSelect={handleClear}
                      className="text-muted-foreground"
                    >
                      Clear {multiSelect ? "All" : "Selection"}
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading="Agents">
                  {agents.map((agent) => (
                    <AgentItem
                      key={agent.id}
                      agent={agent}
                      isSelected={selectedIds.includes(agent.id)}
                      onPeek={(agent) => setPeekedAgent(agent)}
                      onSelect={() => handleSelect(agent.id)}
                    />
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </HoverCard>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface AgentItemProps {
  agent: { id: string } & AgentMappingItem;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (agent: { id: string } & AgentMappingItem) => void;
}

function AgentItem({ agent, isSelected, onSelect, onPeek }: AgentItemProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  useMutationObserver(ref, (mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onPeek(agent);
      }
    });
  });

  return (
    <CommandItem
      key={agent.id}
      onSelect={onSelect}
      ref={ref}
      className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="truncate">{agent.name}</div>
            {agent.description && (
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {agent.description}
              </div>
            )}
          </div>
        </div>
        <Check
          className={cn(
            "ml-auto flex-shrink-0",
            isSelected ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
    </CommandItem>
  );
}
