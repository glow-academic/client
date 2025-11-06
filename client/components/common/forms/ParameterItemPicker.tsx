/**
 * ParameterItemPicker.tsx
 * Picker for selecting ParameterItem(s) for a given Parameter, with search and create-new flow
 * Supports both single-select and multi-select modes with badge display
 * Refactored to use mapping-based API pattern
 * 05/20/2025
 */
"use client";

import { Check, ChevronsUpDown, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  CreateParameterItemIn,
  CreateParameterItemOut,
} from "@/app/(main)/management/parameters/page";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type ParameterItemMappingItem = {
  name: string;
  description: string;
  parameter_id: string;
  parameter_name: string;
  value: string;
};

export interface ParameterItemPickerProps<
  T extends ParameterItemMappingItem = ParameterItemMappingItem,
> {
  mapping: Record<string, T>;
  validIds: string[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  parameterId: string;
  parameterName: string;
  parameterDescription?: string;
  disabled?: boolean;
  allowCreateForDefaultParameters?: boolean;
  allowCreate?: boolean;
  isDefaultParameter?: boolean;
  /** Enable multi-select mode with badge display */
  multiSelect?: boolean;
  /** Where to render the selected badges relative to the button */
  badgesPosition?: "above" | "below";
  /** Show a Clear All button when items are selected */
  showClearAll?: boolean;
  /** Hide the selected badges (for compact display) */
  hideSelectedChips?: boolean;
  /** Compact mode - smaller button, no label */
  compact?: boolean;
  /** Custom button className */
  buttonClassName?: string;
  /** Show required indicator */
  required?: boolean;
  /** Server action for creating parameter items */
  createParameterItemAction?: (
    input: CreateParameterItemIn,
  ) => Promise<CreateParameterItemOut>;
}

export function ParameterItemPicker<
  T extends ParameterItemMappingItem = ParameterItemMappingItem,
>({
  mapping,
  validIds,
  selectedIds,
  onSelect,
  parameterId,
  parameterName,
  parameterDescription,
  disabled = false,
  allowCreateForDefaultParameters = false,
  allowCreate = true,
  isDefaultParameter = false,
  multiSelect = false,
  badgesPosition = "below",
  showClearAll = false,
  hideSelectedChips = false,
  compact = false,
  buttonClassName,
  required = false,
  createParameterItemAction,
}: ParameterItemPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  // Build items from mapping
  const items = useMemo(() => {
    return validIds.map((id) => ({
      id,
      ...mapping[id],
    }));
  }, [validIds, mapping]);

  // Robust multi-term search across name, description
  const filteredItems = useMemo(() => {
    const tokens = search
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length === 0) return items;
    return items.filter((item) => {
      const haystack = `${item.name} ${item.description ?? ""}`.toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });
  }, [items, search]);

  const handleItemSelect = (itemId: string) => {
    if (multiSelect) {
      // Toggle behavior - don't close popover
      const isSelected = selectedIds.includes(itemId);
      const newIds = isSelected
        ? selectedIds.filter((id) => id !== itemId)
        : [...selectedIds, itemId];
      onSelect(newIds);
    } else {
      // Single select - close popover
      onSelect([itemId]);
      setOpen(false);
    }
  };

  const handleClear = () => {
    onSelect([]);
    if (!multiSelect) {
      setOpen(false);
    }
  };

  const handleRemoveItem = (itemId: string) => {
    onSelect(selectedIds.filter((id) => id !== itemId));
  };

  const getButtonText = () => {
    const requiredIndicator = required ? " *" : "";
    if (selectedIds.length === 0) {
      return `Select ${parameterName.toLowerCase()}${requiredIndicator}`;
    }
    if (multiSelect) {
      return `${selectedIds.length} ${parameterName.toLowerCase()} selected${requiredIndicator}`;
    }
    return (
      (mapping[selectedIds[0]!]?.name ||
        `Select ${parameterName.toLowerCase()}`) + requiredIndicator
    );
  };

  const canOfferCreate =
    allowCreate &&
    !!createParameterItemAction &&
    (allowCreateForDefaultParameters || !isDefaultParameter) &&
    search.trim().length > 0 &&
    filteredItems.length === 0;

  const openCreateDialog = () => {
    setNewName(search.trim());
    setNewDescription("");
    setShowCreateDialog(true);
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!createParameterItemAction) {
      toast.error("Create action is not available");
      return;
    }

    // Enforce uniqueness of value (which equals name) within this parameter
    const proposedValue = newName.trim();
    const duplicate = items.some(
      (i) => i.name?.trim().toLowerCase() === proposedValue.toLowerCase(),
    );
    if (duplicate) {
      toast.error("An item with the same value already exists");
      return;
    }
    try {
      setIsCreating(true);
      const created = await createParameterItemAction({
        body: {
          parameterId: parameterId,
          name: newName.trim(),
          description: newDescription.trim(),
          value: proposedValue,
        },
      });

      toast.success("Parameter item created");
      setShowCreateDialog(false);
      if (!multiSelect) {
        setOpen(false);
      }
      // Refresh to get updated parameter items
      router.refresh();
      // In multi-select mode, add to existing selection; in single-select, replace
      if (multiSelect && created.parameterItemId) {
        onSelect([...selectedIds, created.parameterItemId]);
      } else if (created.parameterItemId) {
        onSelect([created.parameterItemId]);
      }
    } catch (error) {
      toast.error("Failed to create parameter item", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Badge display for multi-select mode
  const Badges = (
    <div className="flex flex-wrap gap-1">
      {selectedIds.map((id) => {
        const item = mapping[id];
        if (!item) return null;
        return (
          <Badge
            key={id}
            variant="secondary"
            className="flex items-center gap-1"
          >
            <span className="truncate max-w-[200px]">{item.name}</span>
            <button
              type="button"
              aria-label={`Remove ${item.name}`}
              onClick={() => handleRemoveItem(id)}
              className="inline-flex items-center"
              disabled={disabled}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}
    </div>
  );

  return (
    <div className={compact ? "" : "grid gap-2"}>
      {/* Show badges above button if configured */}
      {multiSelect &&
        !hideSelectedChips &&
        selectedIds.length > 0 &&
        badgesPosition === "above" && <div className="mb-2">{Badges}</div>}

      <Popover
        open={disabled ? false : open}
        onOpenChange={disabled ? () => {} : setOpen}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={`Select ${parameterName}`}
            className={cn(
              compact
                ? "h-7 px-2 text-xs justify-between w-full"
                : "w-full justify-between",
              buttonClassName,
            )}
            size={compact ? "sm" : "default"}
            disabled={disabled}
          >
            <span className="truncate">{getButtonText()}</span>
            <ChevronsUpDown
              className={compact ? "h-3 w-3 opacity-50" : "opacity-50"}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[360px] p-0">
          <Command>
            <CommandInput
              placeholder={`Search ${parameterName.toLowerCase()}...`}
              value={search}
              onValueChange={setSearch}
            />
            {canOfferCreate ? (
              <CommandEmpty>
                <div className="p-3 space-y-2">
                  <div>No items found.</div>
                  <Button size="sm" onClick={openCreateDialog}>
                    Add "{search.trim()}"
                  </Button>
                </div>
              </CommandEmpty>
            ) : (
              <CommandEmpty>No items found.</CommandEmpty>
            )}
            <CommandList className="max-h-[400px]">
              <CommandGroup heading={parameterName}>
                {selectedIds.length > 0 && (
                  <CommandItem
                    onSelect={handleClear}
                    className="text-muted-foreground"
                  >
                    Clear {multiSelect ? "All" : "Selection"}
                  </CommandItem>
                )}
                {filteredItems
                  .slice()
                  .sort((a, b) => {
                    return (a.name || "").localeCompare(b.name || "");
                  })
                  .map((item) => (
                    <CommandItem
                      key={item.id}
                      onSelect={() => handleItemSelect(item.id)}
                      value={`${item.name} ${item.description ?? ""}`}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </div>
                          )}
                        </div>
                        <Check
                          className={cn(
                            "ml-auto",
                            selectedIds.includes(item.id)
                              ? "opacity-100"
                              : "opacity-0",
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

      {/* Show badges below button if configured */}
      {multiSelect &&
        !hideSelectedChips &&
        selectedIds.length > 0 &&
        badgesPosition === "below" && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1">{Badges}</div>
            {showClearAll && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={disabled}
              >
                Clear All
              </Button>
            )}
          </div>
        )}

      {/* Create custom item dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{parameterName}</DialogTitle>
            <DialogDescription>
              {parameterDescription ||
                `Create a new ${parameterName.toLowerCase()} item`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="new-item-name">Name</Label>
              <Input
                id="new-item-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`Name for ${parameterName.toLowerCase()} option`}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-item-description">Description</Label>
              <Input
                id="new-item-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ParameterItemPicker;
