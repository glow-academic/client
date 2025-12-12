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

type DocumentItem = {
  document_id: string;
  name: string;
  updatedAt: string;
  extension: string;
  scenario_ids: string[];
  can_edit: boolean;
  can_delete: boolean;
  active: boolean;
  department_ids: string[] | null;
  file_path: string | null;
  mime_type: string | null;
  field_ids: string[];
};

export interface DocumentSelectProps {
  documents: DocumentItem[];
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
    (doc) => doc.document_id === selectedDocumentId,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          style={{
            minHeight: "2.5rem",
            display: "flex",
            alignItems: "center",
          }}
        >
          <span
            className="flex-1 min-w-0 truncate text-left"
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "block",
            }}
          >
            {selectedDocument?.name || placeholder}
          </span>
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
                  key={doc.document_id}
                  value={doc.name}
                  onSelect={() => {
                    onDocumentSelect(doc.document_id);
                    setOpen(false);
                  }}
                  className="truncate"
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      selectedDocumentId === doc.document_id
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
