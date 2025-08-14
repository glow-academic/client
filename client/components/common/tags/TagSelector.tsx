"use client";

import { Check, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { searchTags } from "@/utils/tags/search-tags";

export interface TagSelectorProps {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Optional list of known tags to suggest from. If not provided, suggestions list will be empty until you pass options. */
  knownTags?: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Where to render the selected tag badges relative to the input */
  badgesPosition?: "above" | "below";
  /** When true, shows a Clear button to remove all selected tags */
  showClearAll?: boolean;
}

export function TagSelector({
  value,
  onChange,
  knownTags = [],
  placeholder = "Add tag...",
  disabled = false,
  className,
  badgesPosition = "above",
  showClearAll = false,
}: TagSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const suggestions = React.useMemo(() => {
    return searchTags(query, knownTags);
  }, [query, knownTags]);

  const toggleTag = (tag: string) => {
    const normalized = tag.trim();
    if (!normalized) return;

    if (value.includes(normalized)) {
      // Remove tag if already selected
      onChange(value.filter((t) => t !== normalized));
    } else {
      // Add tag if not selected
      onChange([...value, normalized]);
    }
    setQuery("");
  };

  const addTag = (tag: string) => {
    const normalized = tag.trim();
    if (!normalized) return;
    if (!value.includes(normalized)) {
      onChange([...value, normalized]);
    }
    setQuery("");
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(query);
    }
    if (e.key === "Backspace" && !query && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const Badges = (
    <div className="flex flex-wrap gap-1">
      {value.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="flex items-center gap-1"
        >
          <span>{tag}</span>
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => removeTag(tag)}
            className="inline-flex items-center"
            disabled={disabled}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );

  return (
    <div className={className}>
      {badgesPosition === "above" && <div className="mb-2">{Badges}</div>}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="flex gap-2 items-center">
            <Input
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={disabled}
            />
            <Button
              type="button"
              variant="default"
              disabled={disabled}
              onClick={() => addTag(query)}
            >
              Add
            </Button>
            {showClearAll && value.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                disabled={disabled}
                onClick={() => onChange([])}
              >
                Clear
              </Button>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search tags..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>No tags found</CommandEmpty>
              <CommandGroup heading="Suggestions">
                {suggestions.map((tag) => (
                  <CommandItem key={tag} onSelect={() => toggleTag(tag)}>
                    <div className="flex items-center justify-between w-full">
                      <span>{tag}</span>
                      {value.includes(tag) && <Check className="h-4 w-4" />}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {badgesPosition === "below" && <div className="mt-2">{Badges}</div>}
    </div>
  );
}

export default TagSelector;
