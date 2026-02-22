"use client";

import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { InsightItem } from "@/contexts/insights-context";

export interface InsightsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insights: InsightItem[];
  onGenerate: (instructions: string) => void;
  isGenerating: boolean;
}

export function InsightsModal({
  open,
  onOpenChange,
  insights,
  onGenerate,
  isGenerating,
}: InsightsModalProps) {
  const [instructions, setInstructions] = useState("");
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = insights.length;

  const handleGenerate = () => {
    onGenerate(instructions.trim());
    setInstructions("");
  };

  const handleCancel = () => {
    onOpenChange(false);
    setInstructions("");
  };

  const handlePrev = () => {
    setCurrentPage((p) => Math.max(0, p - 1));
  };

  const handleNext = () => {
    setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
  };

  const currentInsight = totalPages > 0 ? insights[currentPage] : null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle>Insights</AlertDialogTitle>
          <AlertDialogDescription>
            Generate new insights or browse previous ones.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col">
          {/* Instructions input */}
          <div className="space-y-2">
            <Label htmlFor="insights-instructions">Instructions (Optional)</Label>
            <Textarea
              id="insights-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g., Focus on trends, highlight anomalies..."
              className="min-h-[80px]"
              disabled={isGenerating}
            />
          </div>

          {/* Past insights pagination */}
          {totalPages > 0 && (
            <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between">
                <Label>Past Insights</Label>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handlePrev}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground min-w-[60px] text-center">
                    {currentPage + 1} of {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleNext}
                    disabled={currentPage === totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="rounded-md border bg-muted/50 p-3 overflow-y-auto flex-1 text-sm whitespace-pre-wrap">
                {currentInsight?.content || "No content available."}
              </div>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isGenerating}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isGenerating ? "Generating..." : "Generate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
