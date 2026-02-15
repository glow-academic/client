/**
 * FullPageGenerateButton.tsx
 * Button component for triggering full page generation
 * Shows next to DraftPicker when generation is available
 *
 * Uses artifact_has_generation from profile context (SSR) to determine visibility.
 * Dispatches a simple event that page components listen to.
 */

"use client";

import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/settings-context";
import { Sparkles } from "lucide-react";
import { useCallback } from "react";

interface FullPageGenerateButtonProps {
  artifactType?: string | null;
}

export function FullPageGenerateButton({ artifactType }: FullPageGenerateButtonProps) {
  const { artifactHasGeneration } = useSettings();

  const hasGeneration = artifactType ? artifactHasGeneration[artifactType] ?? false : false;

  const handleGenerate = useCallback(() => {
    window.dispatchEvent(new CustomEvent("full-page-generate"));
  }, []);

  if (!hasGeneration) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 pr-2"
      onClick={handleGenerate}
    >
      <Sparkles className="h-4 w-4 mr-2" />
      Generate
    </Button>
  );
}
