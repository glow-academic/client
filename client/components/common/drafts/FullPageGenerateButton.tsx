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
import { useProfile } from "@/contexts/profile-context";
import { normalizeUrlPathToArtifactType } from "@/utils/resource-type-utils";
import { Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

export function FullPageGenerateButton() {
  const pathname = usePathname();
  const { artifactHasGeneration } = useProfile();

  // Compute artifactType from URL (same logic as layout-client)
  const urlPathSegment = useMemo(() => {
    const match = pathname?.match(
      /^\/(create|management|engine|system)\/([^/]+)/
    );
    return match ? match[2] : null;
  }, [pathname]);

  const artifactType = useMemo(() => {
    return urlPathSegment
      ? normalizeUrlPathToArtifactType(urlPathSegment)
      : null;
  }, [urlPathSegment]);

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
