/**
 * FullPageGenerateButton.tsx
 * Button component for triggering full page generation
 * Shows next to DraftPicker when generation is available
 */

"use client";

import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useCallback } from "react";
import { useGenerationContext } from "@/contexts/generation-context";

export function FullPageGenerateButton() {
  const { getGenerationCapability } = useGenerationContext();
  const capability = getGenerationCapability();

  const handleGenerate = useCallback(() => {
    // Dispatch custom event that page components can listen to
    window.dispatchEvent(new CustomEvent("full-page-generate"));
  }, []);

  // Don't show button if no generation capability is set
  if (!capability) {
    return null;
  }

  // Don't show button if generation is not available
  if (!capability.canGenerate) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 mr-2"
      onClick={handleGenerate}
    >
      <Sparkles className="h-4 w-4 mr-2" />
      Generate
    </Button>
  );
}
