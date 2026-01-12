/**
 * Resource Type Utilities
 * 
 * Maps plural URL resource types to singular artifact enum values used in the database.
 * This ensures frontend resource types match the database artifacts enum.
 */

/**
 * Normalizes a plural URL resource type to its singular artifact enum value.
 * 
 * @param resourceType - The resource type from URL path (e.g., "personas", "scenarios")
 * @returns The singular artifact enum value (e.g., "persona", "scenario")
 * 
 * @example
 * normalizeResourceTypeToArtifact("personas") // returns "persona"
 * normalizeResourceTypeToArtifact("scenarios") // returns "scenario"
 * normalizeResourceTypeToArtifact("auth") // returns "auth" (already singular)
 */
export function normalizeResourceTypeToArtifact(resourceType: string): string {
  const mapping: Record<string, string> = {
    // Standard plural to singular mappings
    personas: "persona",
    scenarios: "scenario",
    simulations: "simulation",
    cohorts: "cohort",
    documents: "document",
    parameters: "parameter",
    fields: "field",
    agents: "agent",
    models: "model",
    rubrics: "rubric",
    evals: "eval",
    departments: "department",
    providers: "provider",
    keys: "key",
    settings: "setting",
    
    // Special mappings
    staff: "profile", // staff management maps to profile artifact
    practice: "simulation", // practice maps to simulation
    benchmark: "eval", // benchmark maps to eval
    
    // Already singular (no change needed)
    auth: "auth",
  };

  // Return mapped value if exists, otherwise return as-is (might already be singular)
  return mapping[resourceType] ?? resourceType;
}
