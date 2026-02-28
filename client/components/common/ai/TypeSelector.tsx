"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PanelTab } from "@/hooks/use-generation-panel";

interface TypeSelectorProps {
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  artifactTypes: string[];
  resourceTypes: string[];
  entryTypes: string[];
  selectedArtifactTypes: string[];
  selectedResourceTypes: string[];
  selectedEntryTypes: string[];
  onToggleArtifactType: (type: string) => void;
  onToggleResourceType: (type: string) => void;
  onToggleEntryType: (type: string) => void;
}

function formatLabel(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getGridColumns(count: number): string {
  if (count <= 2) return "grid-cols-2";
  if (count <= 4) return "grid-cols-2";
  return "grid-cols-3";
}

const TABS: { key: PanelTab; label: string }[] = [
  { key: "artifacts", label: "Artifacts" },
  { key: "resources", label: "Resources" },
  { key: "entries", label: "Entries" },
];

export function TypeSelector({
  activeTab,
  onTabChange,
  artifactTypes,
  resourceTypes,
  entryTypes,
  selectedArtifactTypes,
  selectedResourceTypes,
  selectedEntryTypes,
  onToggleArtifactType,
  onToggleResourceType,
  onToggleEntryType,
}: TypeSelectorProps) {
  const currentTypes =
    activeTab === "artifacts"
      ? artifactTypes
      : activeTab === "resources"
        ? resourceTypes
        : entryTypes;

  const selectedTypes =
    activeTab === "artifacts"
      ? selectedArtifactTypes
      : activeTab === "resources"
        ? selectedResourceTypes
        : selectedEntryTypes;

  const onToggle =
    activeTab === "artifacts"
      ? onToggleArtifactType
      : activeTab === "resources"
        ? onToggleResourceType
        : onToggleEntryType;

  return (
    <div className="p-3 space-y-3">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-md bg-muted p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "flex-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors",
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Chip grid */}
      {currentTypes.length > 0 ? (
        <div className={cn("grid gap-1.5", getGridColumns(currentTypes.length))}>
          {currentTypes.map((type) => {
            const isSelected = selectedTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => onToggle(type)}
                className={cn(
                  "relative flex items-center justify-center rounded-md border px-2 py-1.5 text-xs font-medium transition-all",
                  "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground",
                )}
              >
                {isSelected && (
                  <Check className="absolute right-1 top-1 h-3 w-3 text-primary" />
                )}
                {formatLabel(type)}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          No types available
        </p>
      )}
    </div>
  );
}
