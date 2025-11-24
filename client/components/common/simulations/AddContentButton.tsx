"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Video, FileText } from "lucide-react";
import React from "react";

export interface AddContentButtonProps {
  onAddScenario: () => void;
  onAddVideo: () => void;
  disabled?: boolean;
}

export function AddContentButton({
  onAddScenario,
  onAddVideo,
  disabled = false,
}: AddContentButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" disabled={disabled}>
          <Plus className="h-4 w-4 mr-2" />
          Add Content
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onAddScenario}>
          <FileText className="h-4 w-4 mr-2" />
          Add Scenario
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAddVideo}>
          <Video className="h-4 w-4 mr-2" />
          Add Video
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

