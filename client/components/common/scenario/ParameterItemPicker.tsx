/**
 * ParameterItemPicker.tsx
 * Picker for selecting a single ParameterItem for a given Parameter, with search and create-new flow
 * 05/20/2025
 */
"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useCreateParameterItem } from "@/lib/api/hooks/parameter_items";

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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Parameter, ParameterItem } from "@/types";
import { log } from "@/utils/logger";

export interface ParameterItemPickerProps {
  parameter: Parameter;
  items: ParameterItem[];
  selectedItem?: ParameterItem;
  onSelect: (parameterItemId: string | null) => void;
  disabled?: boolean;
  allowCreateForDefaultParameters?: boolean;
  allowCreate?: boolean; // gate creating new items entirely
}

export function ParameterItemPicker({
  parameter,
  items,
  selectedItem,
  onSelect,
  disabled = false,
  allowCreateForDefaultParameters = false,
  allowCreate = true,
}: ParameterItemPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const createParameterItemMutation = useCreateParameterItem();

  // Robust multi-term search across name, description, and value
  const filteredItems = useMemo(() => {
    const tokens = search
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length === 0) return items;
    return items.filter((item) => {
      const haystack =
        `${item.name} ${item.description ?? ""} ${item.value}`.toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });
  }, [items, search]);

  const handleItemSelect = (item: ParameterItem) => {
    onSelect(item.id);
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setOpen(false);
  };

  const canOfferCreate =
    allowCreate &&
    (allowCreateForDefaultParameters || parameter.defaultParameter === false) &&
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

    // Enforce uniqueness of value (which equals name) within this parameter
    const proposedValue = newName.trim();
    const duplicate = items.some(
      (i) => i.value.trim().toLowerCase() === proposedValue.toLowerCase(),
    );
    if (duplicate) {
      toast.error("An item with the same value already exists");
      return;
    }
    try {
      const created = await createParameterItemMutation.mutateAsync({
        name: newName.trim(),
        description: newDescription.trim(),
        value: proposedValue,
        parameterId: parameter.id,
      });

      toast.success("Parameter item created");
      setShowCreateDialog(false);
      setOpen(false);
      onSelect((created as ParameterItem).id);
    } catch (error) {
      log.error("parameter_item.create.failed", {
        message: "Failed to create parameter item",
        error,
        context: {
          component: "ParameterItemPicker",
          parameterId: parameter.id,
        },
      });
      toast.error("Failed to create parameter item");
    }
  };

  return (
    <div className="grid gap-2">
      <Popover
        open={disabled ? false : open}
        onOpenChange={disabled ? () => {} : setOpen}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={`Select ${parameter.name}`}
            className="w-full justify-between"
            disabled={disabled}
          >
            <span className="truncate">
              {selectedItem
                ? selectedItem.name
                : `Select ${parameter.name.toLowerCase()}`}
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[360px] p-0">
          <Command>
            <CommandInput
              placeholder={`Search ${parameter.name.toLowerCase()}...`}
              value={search}
              onValueChange={setSearch}
            />
            {canOfferCreate ? (
              <CommandEmpty>
                <div className="p-3 space-y-2">
                  <div>No items found.</div>
                  <Button size="sm" onClick={openCreateDialog}>
                    Add “{search.trim()}”
                  </Button>
                </div>
              </CommandEmpty>
            ) : (
              <CommandEmpty>No items found.</CommandEmpty>
            )}
            <CommandList className="max-h-[400px]">
              <CommandGroup heading={parameter.name}>
                {selectedItem && (
                  <CommandItem
                    onSelect={handleClear}
                    className="text-muted-foreground"
                  >
                    Clear Selection
                  </CommandItem>
                )}
                {filteredItems
                  .slice()
                  .sort((a, b) => {
                    if ((a.defaultItem ?? false) !== (b.defaultItem ?? false)) {
                      return (b.defaultItem ? 1 : 0) - (a.defaultItem ? 1 : 0);
                    }
                    return a.name.localeCompare(b.name);
                  })
                  .map((item) => (
                    <CommandItem
                      key={item.id}
                      onSelect={() => handleItemSelect(item)}
                      value={`${item.name} ${item.description ?? ""} ${item.value}`}
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
                        {!item.defaultItem && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="secondary"
                                className="text-xs ml-2 shrink-0"
                              >
                                Custom
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              Not system approved. Added by a user.
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <Check
                          className={cn(
                            "ml-auto",
                            selectedItem?.id === item.id
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

      {/* Create custom item dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{parameter.name}</DialogTitle>
            <DialogDescription>{parameter.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="new-item-name">Name</Label>
              <Input
                id="new-item-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`Name for ${parameter.name.toLowerCase()} option`}
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
              disabled={createParameterItemMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createParameterItemMutation.isPending}
            >
              {createParameterItemMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ParameterItemPicker;
