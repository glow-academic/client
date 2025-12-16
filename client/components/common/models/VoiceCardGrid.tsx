"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { VOICES } from "@/components/common/forms/voices";

export interface VoiceCardGridProps {
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  label?: string;
  description?: string;
  readonly?: boolean;
}

export function VoiceCardGrid({
  selectedIds,
  onSelect,
  label = "Voices",
  description = "Select voices",
  readonly = false,
}: VoiceCardGridProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  // Build voices from VOICES array
  const baseVoices = React.useMemo(() => {
    return [...VOICES].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );
  }, []);

  // Apply search filter, then sort selected first
  const filteredVoices = React.useMemo(() => {
    let filtered = baseVoices;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (voice) =>
          voice.name?.toLowerCase().includes(searchLower) ||
          voice.id?.toLowerCase().includes(searchLower)
      );
    }

    // Sort: selected voices first, then unselected by name
    return filtered.sort((a, b) => {
      const aSelected = selectedIds.includes(a.id);
      const bSelected = selectedIds.includes(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [baseVoices, searchTerm, selectedIds]);

  const handleSelect = (voiceId: string) => {
    if (readonly) return;
    const isSelected = selectedIds.includes(voiceId);
    const newIds = isSelected
      ? selectedIds.filter((id) => id !== voiceId)
      : [...selectedIds, voiceId];
    onSelect(newIds);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
          <Search className="size-4 shrink-0 opacity-50" />
          <input
            type="text"
            placeholder={`Search ${label.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={readonly}
          />
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[272px] overflow-y-auto py-2 px-2">
          {filteredVoices.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No voices found. Try adjusting your search.
            </div>
          ) : (
            filteredVoices.map((voice) => {
              const isSelected = selectedIds.includes(voice.id);

              return (
                <Tooltip key={voice.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleSelect(voice.id)}
                      disabled={readonly}
                      className={cn(
                        "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                        "hover:shadow-md hover:bg-accent/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "disabled:pointer-events-none disabled:opacity-50",
                        isSelected && "ring-2 ring-primary bg-accent"
                      )}
                    >
                      {/* Check icon - top right */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm leading-tight">
                          {voice.name || "Unnamed Voice"}
                        </h3>
                      </div>
                    </button>
                  </TooltipTrigger>
                </Tooltip>
              );
            })
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

