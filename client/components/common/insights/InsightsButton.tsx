"use client";

import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/settings-context";
import { Sparkles } from "lucide-react";
import { useCallback } from "react";

interface InsightsButtonProps {
  artifactType?: string | null;
}

export function InsightsButton({ artifactType }: InsightsButtonProps) {
  const { artifactHasInsights } = useSettings();

  const hasInsights = artifactType ? artifactHasInsights[artifactType] ?? false : false;

  const handleClick = useCallback(() => {
    window.dispatchEvent(new CustomEvent("open-insights-modal"));
  }, []);

  if (!hasInsights) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 pr-2"
      onClick={handleClick}
    >
      <Sparkles className="h-4 w-4 mr-2" />
      Insights
    </Button>
  );
}
