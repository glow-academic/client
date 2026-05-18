/**
 * TestLobby.tsx
 * Pre-start screen for the test chat interface.
 * Shows eval info and a Start button before the test begins.
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Infinity, Play } from "lucide-react";

export interface TestLobbyProps {
  test_id: string;
  eval_name: string | null;
  eval_description: string | null;
  rubric_name: string | null;
  infinite_mode: boolean;
  on_start: () => void;
  is_starting: boolean;
  is_connected: boolean;
}

export function TestLobby({
  eval_name,
  eval_description,
  rubric_name,
  infinite_mode,
  on_start,
  is_starting,
  is_connected,
}: TestLobbyProps) {
  return (
    <div className="h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {eval_name ?? "Evaluation"}
          </CardTitle>
          {eval_description && (
            <p className="text-sm text-muted-foreground mt-2">
              {eval_description}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Eval details */}
          <div className="flex flex-wrap gap-3 justify-center text-sm">
            {rubric_name && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Rubric:</span>
                <span className="font-medium">{rubric_name}</span>
              </div>
            )}
            {infinite_mode && (
              <Badge variant="secondary" className="gap-1">
                <Infinity className="h-3 w-3" />
                Infinite Mode
              </Badge>
            )}
          </div>

          {/* Start button */}
          <div className="flex justify-center pt-2">
            <Button
              onClick={on_start}
              disabled={is_starting || !is_connected}
              size="lg"
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              {is_starting ? "Starting..." : "Start Evaluation"}
            </Button>
          </div>

          {!is_connected && (
            <p className="text-xs text-muted-foreground text-center">
              Connecting to server...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
