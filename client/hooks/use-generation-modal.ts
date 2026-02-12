import { useCallback, useEffect, useState } from "react";
import type { GenerateRegenerateModalResource } from "@/components/common/forms/GenerateRegenerateModal";

/**
 * Manages generate/regenerate modal state and handlers.
 *
 * Handles:
 * - Modal open/close, mode (generate vs regenerate), resources, instructions
 * - handleOpenStepCardModal: opens modal for a step with correct resources
 * - handleModalGenerate: fires onGenerate and closes modal
 * - full-page-generate listener: opens the "all" step modal
 */
export function useGenerationModal<RT extends string>(config: {
  stepResources: Record<string, RT[]>;
  resourceLabels: Partial<Record<RT, string>>;
  canRegenerate: (rt: RT) => boolean;
  onGenerate: (selectedResources: RT[], instructions?: string) => void;
  isGenerating: (rt: RT) => boolean;
}) {
  const { stepResources, resourceLabels, canRegenerate, onGenerate, isGenerating } =
    config;

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [modalMode, setModalMode] = useState<"generate" | "regenerate" | null>(
    null
  );
  const [modalResources, setModalResources] = useState<
    GenerateRegenerateModalResource[]
  >([]);
  const [modalInstructions, setModalInstructions] = useState("");

  const handleOpenStepCardModal = useCallback(
    (stepId: string, mode: "generate" | "regenerate") => {
      const resourceTypes = stepResources[stepId] || [];
      const resources: GenerateRegenerateModalResource[] = resourceTypes.map(
        (rt) => ({
          id: rt,
          label: resourceLabels[rt] ?? "",
          active: mode === "regenerate" ? canRegenerate(rt) : true,
        })
      );

      setModalResources(resources);
      setModalMode(mode);
      setModalInstructions("");
      setShowGenerateModal(true);
    },
    [stepResources, resourceLabels, canRegenerate]
  );

  const handleModalGenerate = useCallback(
    async (selectedResources: string[], instructions: string) => {
      const resourceTypes = selectedResources as RT[];
      onGenerate(resourceTypes, instructions.trim() || undefined);
      setShowGenerateModal(false);
      setModalInstructions("");
    },
    [onGenerate]
  );

  // Listen for full-page-generate event from layout
  useEffect(() => {
    const handleFullPageGenerate = () => {
      handleOpenStepCardModal("all", "generate");
    };
    window.addEventListener("full-page-generate", handleFullPageGenerate);
    return () =>
      window.removeEventListener("full-page-generate", handleFullPageGenerate);
  }, [handleOpenStepCardModal]);

  return {
    handleOpenStepCardModal,
    modalProps: {
      open: showGenerateModal,
      onOpenChange: setShowGenerateModal,
      resources: modalResources,
      onResourcesChange: setModalResources,
      instructions: modalInstructions,
      onInstructionsChange: setModalInstructions,
      onGenerate: handleModalGenerate,
      isGenerating:
        modalResources.length > 0 &&
        modalResources.some((r) => isGenerating(r.id as RT)),
      mode: (modalMode ?? "generate") as "generate" | "regenerate",
    },
  };
}
