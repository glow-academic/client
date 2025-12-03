/**
 * VideoPicker.tsx
 * Used to pick videos (for simulations) with department filtering
 * Similar to ScenarioPicker pattern
 * @AshokSaravanan222 & @siladiea
 * 12/02/2025
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import {
  Check,
  ChevronsUpDown,
  Video,
  X,
} from "lucide-react";
import * as React from "react";

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
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMutationObserver } from "@/hooks/use-mutation-observer";
import { cn } from "@/lib/utils";

// Video mapping item type (from simulation detail response)
type VideoMappingItem = {
  name: string;
  description: string;
  length_seconds: number;
};

export interface VideoPickerProps extends PopoverProps {
  videoMapping: Record<string, VideoMappingItem>;
  validVideoIds: string[];
  selectedVideoIds: string[];
  onSelect: (ids: string[]) => void;
  label?: string;
  placeholder?: string;
  description?: string;
  hideSelectedChips?: boolean;
  showLabel?: boolean;
  buttonClassName?: string;
  disabled?: boolean;
}

export function VideoPicker({
  videoMapping,
  validVideoIds,
  selectedVideoIds,
  onSelect,
  label = "Videos",
  placeholder = "Select videos...",
  description = "Select one or more videos to assign to the simulation.",
  hideSelectedChips = true,
  showLabel = true,
  buttonClassName,
  disabled = false,
  ...props
}: VideoPickerProps) {
  const [open, setOpen] = React.useState(false);

  // Build videos from mapping
  const baseVideos = React.useMemo(() => {
    const videos = validVideoIds.map((id) => ({
      id,
      ...videoMapping[id],
    }));

    // Sort by name
    return videos.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [validVideoIds, videoMapping]);

  const [peekedVideo, setPeekedVideo] = React.useState<
    ({ id: string } & VideoMappingItem) | undefined
  >(baseVideos[0] as ({ id: string } & VideoMappingItem) | undefined);

  const handleSelect = (videoId: string) => {
    const isSelected = selectedVideoIds.includes(videoId);
    const newIds = isSelected
      ? selectedVideoIds.filter((id) => id !== videoId)
      : [...selectedVideoIds, videoId];
    onSelect(newIds);
    // Don't close popover in multi-select mode
  };

  // Allow clearing selection
  const handleClear = () => {
    onSelect([]);
    setOpen(false);
  };

  // Remove individual item
  const handleRemoveItem = (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIds = selectedVideoIds.filter((id) => id !== videoId);
    onSelect(newIds);
  };

  const getButtonText = () => {
    if (selectedVideoIds.length === 0) {
      return placeholder;
    }
    if (selectedVideoIds.length === 1) {
      const video = videoMapping[selectedVideoIds[0]!];
      return video?.name || placeholder;
    }
    return `${selectedVideoIds.length} videos selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No ${label} found.`;
  };

  // Format video length
  const formatLength = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="grid gap-2">
      {showLabel && (
        <HoverCard openDelay={200}>
          <HoverCardTrigger asChild>
            <Label htmlFor="videos">{label}</Label>
          </HoverCardTrigger>
          <HoverCardContent
            align="start"
            className="w-[260px] text-sm"
            side="left"
          >
            {description}
          </HoverCardContent>
        </HoverCard>
      )}

      {/* Show selected items */}
      {selectedVideoIds.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedVideoIds.map((id) => {
            const video = videoMapping[id];
            if (!video) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
              >
                <span>{video.name}</span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveItem(id, e)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${video.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Popover open={disabled ? false : open} onOpenChange={disabled ? () => {} : setOpen} {...props}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select videos"
            className={cn("w-full justify-between", buttonClassName)}
            disabled={disabled}
          >
            {getButtonText()}
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[400px] p-0">
          <HoverCard>
            <HoverCardContent
              side="left"
              align="start"
              forceMount
              className="min-h-[200px]"
            >
              <div className="grid gap-2">
                <h4 className="font-medium leading-none">
                  {peekedVideo?.name || "Video selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedVideo?.description || "No description available"}
                </div>
                {peekedVideo && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Length: {formatLength(peekedVideo.length_seconds)}
                  </div>
                )}
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[400px]">
                <CommandInput placeholder="Search videos..." />
                <CommandEmpty>{getSearchNotFoundMessage()}</CommandEmpty>
                <HoverCardTrigger />
                {selectedVideoIds.length > 0 && (
                  <CommandGroup heading="Actions">
                    <CommandItem
                      onSelect={handleClear}
                      className="text-muted-foreground"
                    >
                      Clear All
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading="Videos">
                  {baseVideos.map((video) => (
                    <VideoItem
                      key={video.id}
                      video={video as { id: string } & VideoMappingItem}
                      isSelected={selectedVideoIds.includes(video.id)}
                      onPeek={(v) => setPeekedVideo(v)}
                      onSelect={() => handleSelect(video.id)}
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

interface VideoItemProps {
  video: { id: string } & VideoMappingItem;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (video: { id: string } & VideoMappingItem) => void;
}

function VideoItem({
  video,
  isSelected,
  onSelect,
  onPeek,
}: VideoItemProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  useMutationObserver(ref, (mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onPeek(video);
      }
    });
  });

  // Format video length
  const formatLength = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <CommandItem
      key={video.id}
      onSelect={onSelect}
      ref={ref}
      className="group data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Video className="h-4 w-4 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="truncate">{video.name}</div>
            <div className="mt-1 text-xs text-muted-foreground truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
              {video.description || "No description available"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
              {formatLength(video.length_seconds)}
            </div>
          </div>
        </div>
        <Check
          className={cn(
            "ml-auto flex-shrink-0 group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground",
            isSelected ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </CommandItem>
  );
}

