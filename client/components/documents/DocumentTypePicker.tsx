/**
 * DocumentTypePicker.tsx
 * Rich picker for document types with descriptions
 * Follows PersonaPicker pattern for consistency
 */
"use client";

import { Check, ChevronsUpDown } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMutationObserver } from "@/hooks/use-mutation-observer";
import { cn } from "@/lib/utils";

type DocumentType =
  | "homework"
  | "project"
  | "quiz"
  | "midterm"
  | "lab"
  | "lecture"
  | "syllabus";

export interface DocumentTypePickerProps {
  selectedType?: DocumentType;
  onSelect: (type: DocumentType) => void;
  label?: string;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  compact?: boolean; // Compact mode - no label, smaller button
}

const DOCUMENT_TYPES: {
  value: DocumentType;
  label: string;
  emoji: string;
  description: string;
}[] = [
  {
    value: "homework",
    label: "Homework",
    emoji: "📚",
    description: "Assignments, problem sets, exercises",
  },
  {
    value: "project",
    label: "Project",
    emoji: "🎯",
    description: "Large assignments, final projects, group work",
  },
  {
    value: "quiz",
    label: "Quiz",
    emoji: "❓",
    description: "Short assessments, pop quizzes",
  },
  {
    value: "midterm",
    label: "Midterm",
    emoji: "📝",
    description: "Midterm exams, major tests",
  },
  {
    value: "lab",
    label: "Lab",
    emoji: "🧪",
    description: "Laboratory exercises, practical work",
  },
  {
    value: "lecture",
    label: "Lecture",
    emoji: "📖",
    description: "Lecture notes, slides, presentations",
  },
  {
    value: "syllabus",
    label: "Syllabus",
    emoji: "📋",
    description: "Course syllabus, course outline",
  },
];

export function DocumentTypePicker({
  selectedType,
  onSelect,
  label = "Document Type",
  placeholder = "Select document type...",
  description = "Choose the type of document you're uploading.",
  disabled = false,
  compact = false,
}: DocumentTypePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [peekedType, setPeekedType] = React.useState<
    (typeof DOCUMENT_TYPES)[number] | undefined
  >(undefined);

  const selectedTypeData = React.useMemo(() => {
    return DOCUMENT_TYPES.find((t) => t.value === selectedType);
  }, [selectedType]);

  const handleSelect = (type: DocumentType) => {
    onSelect(type);
    setOpen(false);
  };

  const handleClear = () => {
    onSelect("homework"); // Default to homework
    setOpen(false);
  };

  const getButtonText = () => {
    if (!selectedType || !selectedTypeData) {
      return placeholder;
    }
    return selectedTypeData.label;
  };

  return (
    <div className={compact ? "" : "grid gap-2"}>
      {!compact && (
        <HoverCard openDelay={200}>
          <HoverCardTrigger asChild>
            <Label htmlFor="document-type">{label}</Label>
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

      <Popover
        open={disabled ? false : open}
        onOpenChange={disabled ? () => {} : setOpen}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select document type"
            className={
              compact
                ? "h-7 px-2 text-xs justify-between w-full"
                : "w-full justify-between"
            }
            size={compact ? "sm" : "default"}
            disabled={disabled}
          >
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {selectedTypeData && (
                <span
                  className={
                    compact
                      ? "text-sm flex-shrink-0"
                      : "text-base flex-shrink-0"
                  }
                >
                  {selectedTypeData.emoji}
                </span>
              )}
              <span className="truncate">{getButtonText()}</span>
            </div>
            <ChevronsUpDown
              className={
                compact
                  ? "h-3 w-3 opacity-50 ml-1 flex-shrink-0"
                  : "opacity-50 ml-2 flex-shrink-0"
              }
            />
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
                  {peekedType
                    ? `${peekedType.emoji} ${peekedType.label}`
                    : "No type selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedType?.description || "No description available"}
                </div>
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[400px]">
                <CommandInput placeholder="Search document types..." />
                <CommandEmpty>No document type found.</CommandEmpty>
                {selectedType && (
                  <CommandGroup heading="Actions">
                    <CommandItem
                      onSelect={handleClear}
                      className="text-muted-foreground"
                    >
                      Clear Selection
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading="Document Types">
                  {DOCUMENT_TYPES.map((type) => (
                    <DocumentTypeItem
                      key={type.value}
                      type={type}
                      isSelected={selectedType === type.value}
                      onPeek={(type) => setPeekedType(type)}
                      onSelect={() => handleSelect(type.value)}
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

interface DocumentTypeItemProps {
  type: (typeof DOCUMENT_TYPES)[number];
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (type: (typeof DOCUMENT_TYPES)[number]) => void;
}

function DocumentTypeItem({
  type,
  isSelected,
  onSelect,
  onPeek,
}: DocumentTypeItemProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  useMutationObserver(ref, (mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onPeek(type);
      }
    });
  });

  return (
    <CommandItem
      key={type.value}
      onSelect={onSelect}
      ref={ref}
      className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      <div className="flex items-center gap-3 w-full">
        <span className="text-lg flex-shrink-0">{type.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{type.label}</div>
          <div className="text-sm text-muted-foreground truncate">
            {type.description}
          </div>
        </div>
        <Check
          className={cn("ml-auto", isSelected ? "opacity-100" : "opacity-0")}
        />
      </div>
    </CommandItem>
  );
}
