/**
 * NewScenario.tsx
 * Wrapper component for Scenario.tsx in create mode
 * Maintains compatibility with code that imports NewScenario instead of Scenario
 * @AshokSaravanan222 & @siladiea
 * 01/15/2026
 */

import Scenario, { type ScenarioProps } from "./Scenario";

/**
 * NewScenario - Wrapper component for Scenario in create mode
 * This is a compatibility wrapper that maintains the same API as before
 * while internally using the unified Scenario component
 */
export default function NewScenario(props: Omit<ScenarioProps, "mode">) {
  return <Scenario {...props} mode="create" />;
}

// Re-export types for convenience
export type { ScenarioProps } from "./Scenario";
