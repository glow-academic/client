/**
 * Single-subscription context for `useArtifactGeneration`.
 *
 * Both `GenerationPanel` (which renders the message stream) and
 * `Persona.tsx` (which only reads `isGenerating` to disable the AI
 * buttons) need the same listener for the same `(artifactType, groupId)`
 * pair. Calling `useArtifactGeneration` twice — once per consumer —
 * registered all 7 transport subscriptions twice, so every event fired
 * each handler N×2 times. Visible symptoms: panel flickers; double
 * state writes; ambiguous `setGenerating` provenance.
 *
 * This provider mounts the hook **exactly once** and exposes the
 * resulting `GenerationListener` via context. Consumers read the same
 * shared state. The parent (FullPageLayout) decides scope: the
 * provider wraps both the `GenerationPanel` and the page's `children`,
 * keyed off `panelProps.artifactType` / `panelProps.groupId`.
 */
"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
} from "react";
import { useQueryState, parseAsString } from "nuqs";

import {
  useArtifactGeneration,
  type GenerationListener,
} from "./use-artifact-generation";

const GenerationListenerContext = createContext<GenerationListener | null>(
  null,
);

interface GenerationListenerProviderProps {
  artifactType: string;
  groupId: string | null;
  children: React.ReactNode;
}

export function GenerationListenerProvider({
  artifactType,
  groupId,
  children,
}: GenerationListenerProviderProps) {
  const baseListener = useArtifactGeneration(artifactType, groupId);
  // URL-backed selection. Lives at the provider level so both the
  // panel (event-stream consumer) and the form (StepCard AI button
  // caller) share one writer — same pattern draftId uses for the
  // form. Pre-latch BEFORE generate so refresh-during-generate
  // resolves SSR back to the same group.
  const [selectedGroupId, setSelectedGroupIdRaw] = useQueryState(
    "groupId",
    parseAsString,
  );
  const latchGroupId = useCallback(
    (id: string | null) => {
      // Shallow URL update — the latch exists so refresh-during-generate
      // resolves SSR back to the same group, but the URL change itself
      // shouldn't trigger an RSC re-fetch (which would re-run all the
      // page's audited fetches and double the activity-rail bubbles).
      // Same shape as the parameterIds init effect on Persona.tsx.
      void setSelectedGroupIdRaw(id, { shallow: true });
    },
    [setSelectedGroupIdRaw],
  );
  // Transient "fresh chat intent" flag — purely local state, lost on
  // refresh by design. See the field doc on GenerationListener.
  const [forceNewChat, setForceNewChat] = useState(false);
  const listener = useMemo<GenerationListener>(
    () => ({
      ...baseListener,
      selectedGroupId,
      latchGroupId,
      forceNewChat,
      setForceNewChat,
    }),
    [baseListener, selectedGroupId, latchGroupId, forceNewChat],
  );
  return (
    <GenerationListenerContext.Provider value={listener}>
      {children}
    </GenerationListenerContext.Provider>
  );
}

/** Returns the shared listener. Throws if no provider is mounted —
 *  this is the canonical access point and a missing provider means
 *  the consumer is being rendered outside `FullPageLayout`'s
 *  `panelProps` tree, which is a wiring bug. */
export function useSharedGenerationListener(): GenerationListener {
  const ctx = useContext(GenerationListenerContext);
  if (!ctx) {
    throw new Error(
      "useSharedGenerationListener must be used inside a GenerationListenerProvider " +
        "— make sure this component is rendered through FullPageLayout with panelProps set.",
    );
  }
  return ctx;
}
