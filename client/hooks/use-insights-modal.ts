"use client";

import { useCallback, useEffect, useState } from "react";
import { useInsights } from "@/contexts/insights-context";
import type { InsightsModalProps } from "@/components/common/insights/InsightsModal";

/**
 * useInsightsModal
 * Manages insights modal state — listens for "open-insights-modal" window event,
 * reads past insights from context, and wires up generation callbacks.
 *
 * Same pattern as useGenerationModal listening for "full-page-generate".
 */
export function useInsightsModal(config: {
  onGenerate: (instructions: string) => void;
  isGenerating: boolean;
}): InsightsModalProps {
  const { onGenerate, isGenerating } = config;
  const { insights } = useInsights();
  const [open, setOpen] = useState(false);

  // Listen for "open-insights-modal" event from InsightsButton
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("open-insights-modal", handleOpen);
    return () => window.removeEventListener("open-insights-modal", handleOpen);
  }, []);

  const handleGenerate = useCallback(
    (instructions: string) => {
      onGenerate(instructions);
      setOpen(false);
    },
    [onGenerate],
  );

  return {
    open,
    onOpenChange: setOpen,
    insights,
    onGenerate: handleGenerate,
    isGenerating,
  };
}
