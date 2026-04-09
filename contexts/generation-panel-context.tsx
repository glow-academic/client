"use client";

import React, { createContext, useContext, useMemo } from "react";

interface GenerationPanelContextType {
  togglePanel: () => void;
  panelOpen: boolean;
}

const GenerationPanelContext = createContext<GenerationPanelContextType | null>(null);

/**
 * Returns the generation panel context — null if outside provider.
 * Used by PageHeader to render the toggle button.
 */
export function useGenerationPanelContext(): GenerationPanelContextType | null {
  return useContext(GenerationPanelContext);
}

export function GenerationPanelProvider({
  children,
  togglePanel,
  panelOpen,
}: {
  children: React.ReactNode;
  togglePanel: () => void;
  panelOpen: boolean;
}) {
  const value = useMemo(() => ({ togglePanel, panelOpen }), [togglePanel, panelOpen]);
  return (
    <GenerationPanelContext.Provider value={value}>
      {children}
    </GenerationPanelContext.Provider>
  );
}
