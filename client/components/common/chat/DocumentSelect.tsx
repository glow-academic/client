/**
 * DocumentSelect.tsx
 * Reusable document selection component
 */
"use client";
import { useState } from "react";

// UI Components
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Icons
import { Check, ChevronsUpDown } from "lucide-react";

import { Document } from "@/types";

interface DocumentSelectProps {
  documents: Document[];
  selectedDocumentId: string | null;
  onDocumentSelect: (documentId: string) => void;
  placeholder?: string;
}

export default function DocumentSelect({
  documents,
  selectedDocumentId,
  onDocumentSelect,
  placeholder = "Select document...",
}: DocumentSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedDocument = documents.find(
    (doc) => doc.id === selectedDocumentId
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedDocument?.name || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search documents..." />
          <CommandList>
            <CommandEmpty>No document found.</CommandEmpty>
            <CommandGroup>
              {documents.map((doc) => (
                <CommandItem
                  key={doc.id}
                  value={doc.name}
                  onSelect={() => {
                    onDocumentSelect(doc.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      selectedDocumentId === doc.id
                        ? "opacity-100"
                        : "opacity-0"
                    }`}
                  />
                  <span className="truncate">{doc.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
