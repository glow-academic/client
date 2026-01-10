/**
 * Tool.tsx
 * Tool detail/edit component (skeleton)
 */
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type {
  GetToolOut,
  SaveToolIn,
  SaveToolOut,
  PatchToolDraftIn,
  PatchToolDraftOut,
} from "@/app/(main)/engine/tools/t/[toolId]/page";
import type {
  GetToolOut as GetToolOutNew,
  SaveToolIn as SaveToolInNew,
  SaveToolOut as SaveToolOutNew,
  PatchToolDraftIn as PatchToolDraftInNew,
  PatchToolDraftOut as PatchToolDraftOutNew,
} from "@/app/(main)/engine/tools/new/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface ToolProps {
  toolId?: string;
  // Server-provided data (for server-side rendering)
  toolDetail?: GetToolOut;
  toolDetailDefault?: GetToolOutNew;
  // Server actions
  saveToolAction?: (input: SaveToolIn | SaveToolInNew) => Promise<SaveToolOut | SaveToolOutNew>;
  patchToolDraftAction?: (
    input: PatchToolDraftIn | PatchToolDraftInNew
  ) => Promise<PatchToolDraftOut | PatchToolDraftOutNew>;
}

export default function Tool({
  toolId,
  toolDetail,
  toolDetailDefault,
  saveToolAction,
  patchToolDraftAction,
}: ToolProps) {
  const router = useRouter();
  const isNew = !toolId;
  const data = toolDetail || toolDetailDefault;

  const [name, setName] = useState(data?.name || "");
  const [description, setDescription] = useState(data?.description || "");

  const handleSave = async () => {
    if (!saveToolAction) {
      toast.error("Save action not available");
      return;
    }

    try {
      const saveRequest: SaveToolIn | SaveToolInNew = {
        body: {
          tool_id: toolId || null,
          name: name,
          description: description || null,
        },
      } as SaveToolIn | SaveToolInNew;

      await saveToolAction(saveRequest);
      toast.success(isNew ? "Tool created successfully!" : "Tool updated successfully!");
      router.push("/engine/tools");
    } catch (error) {
      toast.error(
        `Failed to ${isNew ? "create" : "update"} tool: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isNew ? "Create Tool" : "Edit Tool"}
          </h1>
          <p className="text-muted-foreground">
            {isNew
              ? "Create a new tool for teaching assistant training platform."
              : "Edit tool details."}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tool Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter tool name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter tool description"
              rows={4}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={() => router.push("/engine/tools")}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {isNew ? "Create" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
