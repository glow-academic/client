"use client";

import React, { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";

interface GenerationPanelProps {
  panelOpen: boolean;
  onToggle: () => void;
}

export function GenerationPanel({ panelOpen, onToggle }: GenerationPanelProps) {
  const [instructions, setInstructions] = useState("");

  return (
    <SidebarProvider
      open={panelOpen}
      onOpenChange={onToggle}
      className="!min-h-0 !w-auto flex-none"
      style={{ "--sidebar-width": "18rem" } as React.CSSProperties}
    >
      <Sidebar side="right" variant="sidebar" collapsible="offcanvas">
        <SidebarContent className="flex flex-col p-3">
          <div className="text-sm text-muted-foreground">
            AI generation panel
          </div>
        </SidebarContent>
        <SidebarFooter className="p-0">
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Instructions (optional)..."
                className="min-h-[60px] flex-1 resize-none text-sm"
              />
              <Button size="icon" className="self-end">
                <Send className="h-4 w-4" />
                <span className="sr-only">Generate</span>
              </Button>
            </div>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </SidebarProvider>
  );
}
