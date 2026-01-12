"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

/**
 * Generation capability metadata
 */
export interface GenerationCapability {
  artifactType: string; // e.g., "persona", "scenario" (singular artifact type)
  canGenerate: boolean; // true if general_agent_id exists
  agentId: string | null; // general_agent_id or equivalent
}

/**
 * Generation context type
 */
interface GenerationContextType {
  setGenerationCapability: (capability: GenerationCapability) => void;
  clearGenerationCapability: () => void;
  getGenerationCapability: () => GenerationCapability | null;
}

const GenerationContext = createContext<GenerationContextType | undefined>(
  undefined,
);

/**
 * Provider component for generation capability metadata
 */
export function GenerationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [capability, setCapability] = useState<GenerationCapability | null>(
    null,
  );

  const setGenerationCapability = useCallback(
    (newCapability: GenerationCapability) => {
      setCapability(newCapability);
    },
    [],
  );

  const clearGenerationCapability = useCallback(() => {
    setCapability(null);
  }, []);

  const getGenerationCapability = useCallback(() => {
    return capability;
  }, [capability]);

  return (
    <GenerationContext.Provider
      value={{
        setGenerationCapability,
        clearGenerationCapability,
        getGenerationCapability,
      }}
    >
      {children}
    </GenerationContext.Provider>
  );
}

/**
 * Hook to access generation context
 */
export function useGenerationContext() {
  const context = useContext(GenerationContext);
  if (!context) {
    throw new Error(
      "useGenerationContext must be used within a GenerationProvider",
    );
  }
  return context;
}
