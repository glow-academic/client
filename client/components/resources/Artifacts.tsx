/**
 * Artifacts.tsx
 * Resource component for artifact type selection
 * Uses GenericPicker to select artifact types (e.g. agent, problem, simulation)
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback, useMemo } from "react";

export interface ArtifactResourceItem {
  id?: string | null;
  artifact?: string | null;
  generated?: boolean | null;
}

export interface ArtifactsProps {
  artifact_ids?: string[];
  artifact_resources?: ArtifactResourceItem[];
  show_artifacts?: boolean;
  artifact_suggestions?: string[];
  artifacts?: ArtifactResourceItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
}

interface ArtifactItem {
  id: string;
  name: string;
}

export function Artifacts({
  artifact_ids,
  show_artifacts = false,
  artifacts,
  disabled = false,
  onChange,
  label = "Artifacts",
  id = "artifacts",
  required = false,
  placeholder = "Select artifacts...",
  description,
  searchTerm,
  onSearchChange,
}: ArtifactsProps) {
  const ids = useMemo(() => artifact_ids ?? [], [artifact_ids]);
  const allArtifacts = useMemo(() => artifacts ?? [], [artifacts]);

  const filteredArtifacts = useMemo(() => {
    if (!searchTerm?.trim()) return allArtifacts;
    const term = searchTerm.toLowerCase();
    return allArtifacts.filter((a) =>
      (a.artifact?.toLowerCase() ?? "").includes(term)
    );
  }, [allArtifacts, searchTerm]);

  const artifactItems = useMemo<ArtifactItem[]>(() => {
    return filteredArtifacts
      .filter((a) => a.id && a.artifact)
      .map((a) => ({ id: a.id!, name: a.artifact! }));
  }, [filteredArtifacts]);

  const handleSelect = useCallback(
    (selectedIds: string[]) => onChange(selectedIds),
    [onChange]
  );

  if (!show_artifacts) return null;

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
          {description && (
            <span className="text-xs text-muted-foreground ml-2">
              {description}
            </span>
          )}
        </Label>
      )}
      <GenericPicker<ArtifactItem>
        items={artifactItems}
        itemIds={filteredArtifacts
          .map((a) => a.id)
          .filter((id): id is string => id !== null)}
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <span className="truncate">{item.name}</span>
            <Check
              className={cn(
                "ml-auto flex-shrink-0 h-4 w-4",
                isSelected ? "opacity-100" : "opacity-0"
              )}
            />
          </div>
        )}
        {...(searchTerm !== undefined ? { initialSearchTerm: searchTerm } : {})}
        {...(onSearchChange ? { onSearchChange } : {})}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
