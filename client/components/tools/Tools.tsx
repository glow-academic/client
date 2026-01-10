/**
 * Tools.tsx
 * Tools list component (skeleton)
 */
"use client";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  DeleteToolIn,
  DeleteToolOut,
  ToolsListOut,
} from "@/app/(main)/engine/tools/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ToolsProps {
  // Server-provided data (for server-side rendering)
  listData: ToolsListOut;
  // Server actions (replaces useMutation)
  deleteToolAction?: (input: DeleteToolIn) => Promise<DeleteToolOut>;
}

export default function Tools({
  listData: serverListData,
  deleteToolAction,
}: ToolsProps) {
  const router = useRouter();

  // Extract data from response - ensure it's always an array
  const toolsList = useMemo(
    () => (Array.isArray(serverListData?.tools) ? serverListData.tools : []),
    [serverListData?.tools]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tools</h1>
          <p className="text-muted-foreground">
            Manage tools for teaching assistant training platform.
          </p>
        </div>
        <Button onClick={() => router.push("/engine/tools/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Create Tool
        </Button>
      </div>

      {toolsList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground mb-4">No tools found.</p>
            <Button onClick={() => router.push("/engine/tools/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Tool
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {toolsList.map((tool) => {
            const toolId = tool.tool_id ?? "";
            if (!toolId) return null;

            return (
              <Card
                key={toolId}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/engine/tools/t/${toolId}`)}
              >
                <CardHeader>
                  <CardTitle>{tool.name || "Unnamed Tool"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {tool.description || "No description"}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
