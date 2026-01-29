/**
 * ConfigurationGrid.tsx
 * Resource component for scenario configuration flags displayed as a SelectableGrid
 * Shows horizontal scrollable cards for each flag with icon, label, description
 * Multi-select mode: clicking toggles the flag on/off
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { getPersonaIconComponent } from "@/utils/persona-icons";
import { cn } from "@/lib/utils";
import { Check, Power } from "lucide-react";

export interface ConfigurationItem {
  key: string;
  label: string;
  description: string;
  flagId: string | null; // Current flag_id (null if not selected)
  flagOptionId: string | null; // The ID to use when enabling this flag
  iconId?: string | null;
}

export interface ConfigurationGridProps {
  items: ConfigurationItem[];
  disabled?: boolean;
  onToggle: (key: string, flagId: string | null) => void;
}

export function ConfigurationGrid({
  items,
  disabled = false,
  onToggle,
}: ConfigurationGridProps) {
  // Get selected flag IDs for multi-select mode
  const selectedIds = items
    .filter((item) => item.flagId !== null)
    .map((item) => item.key);

  const handleSelect = (key: string) => {
    const item = items.find((i) => i.key === key);
    if (!item) return;

    // Toggle: if currently selected, turn off (null), otherwise turn on (flagOptionId)
    const newFlagId = item.flagId !== null ? null : item.flagOptionId;
    onToggle(key, newFlagId);
  };

  return (
    <SelectableGrid<ConfigurationItem>
      items={items}
      selectedId={null}
      selectedIds={selectedIds}
      onSelect={handleSelect}
      getId={(item) => item.key}
      renderItem={(item, isSelected) => {
        // Get icon component from icon_id or use default Power icon
        const IconComponent = item.iconId
          ? getPersonaIconComponent(item.iconId)
          : null;
        const Icon = IconComponent || Power;

        return (
          <div
            className={cn(
              "relative flex flex-col p-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left h-[88px]",
              "hover:shadow-md hover:bg-accent/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isSelected && "ring-2 ring-primary bg-accent"
            )}
          >
            {/* Check icon - top right when selected */}
            {isSelected && (
              <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                <Check className="h-3 w-3 text-primary-foreground" />
              </div>
            )}

            <div className="flex items-start gap-2 flex-1 overflow-hidden">
              <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 overflow-hidden">
                <h3 className="font-medium text-sm leading-tight truncate">
                  {item.label}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {item.description}
                </p>
              </div>
            </div>
          </div>
        );
      }}
      emptyMessage="No configuration options available."
      disabled={disabled}
      horizontal
    />
  );
}
