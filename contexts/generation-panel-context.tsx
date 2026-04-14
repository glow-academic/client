"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

interface GenerateParams {
  resource_types: string[];
  instructions?: string;
  dangerous?: boolean;
}

interface GenerationPanelContextType {
  togglePanel: () => void;
  panelOpen: boolean;
  // Page-level generation config (set by artifact pages)
  groupId: string | null;
  setGroupId: (id: string | null) => void;
  onGenerate: ((params: GenerateParams) => Promise<void>) | null;
  setOnGenerate: (fn: ((params: GenerateParams) => Promise<void>) | null) => void;
  groupCompletedEvent: string | null;
  setGroupCompletedEvent: (event: string | null) => void;
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
  const [groupId, setGroupId] = useState<string | null>(null);
  const [onGenerateFn, setOnGenerateFn] = useState<((params: GenerateParams) => Promise<void>) | null>(null);
  const [groupCompletedEvent, setGroupCompletedEvent] = useState<string | null>(null);

  // Wrapper to handle React setState quirk with function values
  const setOnGenerate = useCallback((fn: ((params: GenerateParams) => Promise<void>) | null) => {
    setOnGenerateFn(() => fn);
  }, []);

  const value = useMemo(
    () => ({ togglePanel, panelOpen, groupId, setGroupId, onGenerate: onGenerateFn, setOnGenerate, groupCompletedEvent, setGroupCompletedEvent }),
    [togglePanel, panelOpen, groupId, setGroupId, onGenerateFn, setOnGenerate, groupCompletedEvent],
  );
  return (
    <GenerationPanelContext.Provider value={value}>
      {children}
    </GenerationPanelContext.Provider>
  );
}
