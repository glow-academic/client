/**
 * Base schemas and types for v2 API
 * Centralized mapping types used across all resources
 */

import { z } from "zod";

/**
 * ============================================================================
 * ENUM SCHEMAS
 * Source of truth: server responses (Pydantic schemas)
 * ============================================================================
 */

export const ProfileRoleSchema = z.enum([
  "superadmin",
  "admin",
  "instructional",
  "ta",
  "guest",
]);

export const DocumentTypeSchema = z.enum([
  "homework",
  "project",
  "quiz",
  "midterm",
  "lab",
  "lecture",
  "syllabus",
]);

export const FeedbackTypeSchema = z.enum([
  "feature",
  "bug",
  "question",
  "other",
]);

export const AssistantMessageTypeSchema = z.enum(["user", "assistant"]);

export const AssistantToolTypeSchema = z.enum([
  "create",
  "read",
  "update",
  "delete",
]);

export const SimulationMessageTypeSchema = z.enum(["query", "response"]);

export const ReasoningEffortSchema = z.enum([
  "minimal",
  "low",
  "medium",
  "high",
]);

/**
 * Inferred enum types
 */
export type ProfileRole = z.infer<typeof ProfileRoleSchema>;
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export type FeedbackType = z.infer<typeof FeedbackTypeSchema>;
export type AssistantMessageType = z.infer<typeof AssistantMessageTypeSchema>;
export type AssistantToolType = z.infer<typeof AssistantToolTypeSchema>;
export type SimulationMessageType = z.infer<typeof SimulationMessageTypeSchema>;
export type ReasoningEffort = z.infer<typeof ReasoningEffortSchema>;

/**
 * ============================================================================
 * ENUM VALUE CONSTANTS
 * Exported constants for components that need to iterate over enum values
 * ============================================================================
 */

export const PROFILE_ROLES: ProfileRole[] = [
  "superadmin",
  "admin",
  "instructional",
  "ta",
  "guest",
];

export const DOCUMENT_TYPES: DocumentType[] = [
  "homework",
  "project",
  "quiz",
  "midterm",
  "lab",
  "lecture",
  "syllabus",
];

export const FEEDBACK_TYPES: FeedbackType[] = [
  "feature",
  "bug",
  "question",
  "other",
];

export const REASONING_EFFORTS: ReasoningEffort[] = [
  "minimal",
  "low",
  "medium",
  "high",
];

export const ASSISTANT_MESSAGE_TYPES: AssistantMessageType[] = [
  "user",
  "assistant",
];

export const ASSISTANT_TOOL_TYPES: AssistantToolType[] = [
  "create",
  "read",
  "update",
  "delete",
];

export const SIMULATION_MESSAGE_TYPES: SimulationMessageType[] = [
  "query",
  "response",
];

/**
 * ============================================================================
 * MAPPING SCHEMAS
 * ============================================================================
 */

/**
 * Standard mapping item with name and description
 * Used universally across ALL resources for consistency
 * - For scenarios: description = problem_statement
 * - For models: description = model description or empty string
 * - For all others: description = natural description
 */
export const MappingItemSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export type MappingItem = z.infer<typeof MappingItemSchema>;

/**
 * Parameter mapping item with numerical field
 */
export const ParameterMappingItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  numerical: z.boolean(),
});

export type ParameterMappingItem = z.infer<typeof ParameterMappingItemSchema>;

/**
 * Enhanced parameter item mapping with parameter context
 */
export const ParameterItemMappingItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameter_id: z.string(),
  parameter_name: z.string(),
  value: z.string(),
});

export type ParameterItemMappingItem = z.infer<
  typeof ParameterItemMappingItemSchema
>;

/**
 * Custom persona mapping item with additional color and icon fields
 */
export const PersonaMappingItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  color: z.string(),
  icon: z.string(),
});

export type PersonaMappingItem = z.infer<typeof PersonaMappingItemSchema>;

/**
 * Simulation mapping item with time_limit
 */
export const SimulationMappingItemSchema = MappingItemSchema.extend({
  time_limit: z.number().nullable().optional(),
  department_id: z.string(),
});

export type SimulationMappingItem = z.infer<typeof SimulationMappingItemSchema>;

/**
 * Custom agent mapping item with roles field
 */
export const AgentMappingItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  roles: z.array(z.string()),
});

export type AgentMappingItem = z.infer<typeof AgentMappingItemSchema>;

/**
 * Generic mapping schema - id maps to { name, description }
 * This is the universal mapping type used throughout the application
 */
export const MappingSchema = z.record(z.string(), MappingItemSchema);

export type Mapping = z.infer<typeof MappingSchema>;

/**
 * Specific mapping schemas for each resource
 * All currently use the same MappingSchema, but are exported separately
 * for future extensibility (e.g., if ScenarioMappingSchema needs custom fields)
 */
/**
 * Enhanced scenario mapping item with nested data
 */
export const ScenarioMappingItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  persona_id: z.string().nullable(),
  persona_mapping: z.lazy(() => PersonaMappingSchema),
  document_mapping: z.lazy(() => DocumentMappingSchema),
  parameter_item_mapping: z.lazy(() => ParameterItemMappingSchema),
  parameter_item_ids: z.array(z.string()),
  document_ids: z.array(z.string()),
});

export type ScenarioMappingItem = z.infer<typeof ScenarioMappingItemSchema>;

export const DepartmentMappingSchema = MappingSchema;
export const PersonaMappingSchema = z.record(
  z.string(),
  PersonaMappingItemSchema
); // Custom with color and icon
export const RubricMappingSchema = MappingSchema;
export const SimulationMappingSchema = z.record(
  z.string(),
  SimulationMappingItemSchema
); // Custom with time_limit
export const ParameterMappingSchema = z.record(
  z.string(),
  ParameterMappingItemSchema
); // Custom with numerical field
export const CohortMappingSchema = MappingSchema;
export const DocumentMappingSchema = MappingSchema;
export const StaffMappingSchema = MappingSchema;
export const AgentMappingSchema = z.record(z.string(), AgentMappingItemSchema); // Custom with roles
export const ProviderMappingSchema = MappingSchema;
export const ScenarioMappingSchema = z.record(
  z.string(),
  ScenarioMappingItemSchema
);
export const ModelMappingSchema = MappingSchema;
export const ReasoningMappingSchema = MappingSchema;
export const ParameterItemMappingSchema = z.record(
  z.string(),
  ParameterItemMappingItemSchema
);
export const ObjectiveMappingSchema = MappingSchema;
export const ProfileMappingSchema = MappingSchema;

/**
 * Standard group mapping item with rubric context
 */
export const StandardGroupMappingItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  points: z.number(),
  passPoints: z.number(),
});

export type StandardGroupMappingItem = z.infer<
  typeof StandardGroupMappingItemSchema
>;

/**
 * Standard mapping item
 */
export const StandardMappingItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  points: z.number(),
});

export type StandardMappingItem = z.infer<typeof StandardMappingItemSchema>;

export const StandardGroupsMappingSchema = z.record(
  z.string(),
  StandardGroupMappingItemSchema
);
export const StandardsMappingSchema = z.record(
  z.string(),
  StandardMappingItemSchema
);

/**
 * Type aliases for convenience
 */
export type DepartmentMapping = z.infer<typeof DepartmentMappingSchema>;
export type PersonaMapping = z.infer<typeof PersonaMappingSchema>;
export type RubricMapping = z.infer<typeof RubricMappingSchema>;
export type SimulationMapping = z.infer<typeof SimulationMappingSchema>;
export type ParameterMapping = z.infer<typeof ParameterMappingSchema>;
export type CohortMapping = z.infer<typeof CohortMappingSchema>;
export type DocumentMapping = z.infer<typeof DocumentMappingSchema>;
export type StaffMapping = z.infer<typeof StaffMappingSchema>;
export type AgentMapping = z.infer<typeof AgentMappingSchema>;
export type ProviderMapping = z.infer<typeof ProviderMappingSchema>;
export type ScenarioMapping = z.infer<typeof ScenarioMappingSchema>;
export type ModelMapping = z.infer<typeof ModelMappingSchema>;
export type ReasoningMapping = z.infer<typeof ReasoningMappingSchema>;
export type ParameterItemMapping = z.infer<typeof ParameterItemMappingSchema>;
export type ObjectiveMapping = z.infer<typeof ObjectiveMappingSchema>;
export type ProfileMapping = z.infer<typeof ProfileMappingSchema>;
export type StandardGroupsMapping = z.infer<typeof StandardGroupsMappingSchema>;
export type StandardsMapping = z.infer<typeof StandardsMappingSchema>;

/**
 * ============================================================================
 * ANALYTICS COMMON SCHEMAS
 * ============================================================================
 */

/**
 * Analytics filter request schema
 */
export const AnalyticsFiltersSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  cohortIds: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
  simulationFilters: z
    .array(z.enum(["general", "practice", "archived"]))
    .optional(),
  profileId: z.string().nullable().optional(),
  departmentIds: z.array(z.string()).optional(),
});

export type AnalyticsFilters = z.infer<typeof AnalyticsFiltersSchema>;

/**
 * Analytics computation methods enum
 */
export const MethodSchema = z.enum([
  "avg",
  "max",
  "sum",
  "rate",
  "countDistinct",
  "min",
  "slope",
]);

export type Method = z.infer<typeof MethodSchema>;

/**
 * Trend data point
 */
export const TrendDataSchema = z.object({
  date: z.string(),
  value: z.number(),
  count: z.number(),
});

export type TrendData = z.infer<typeof TrendDataSchema>;

/**
 * Individual data point
 */
export const DataPointSchema = z.object({
  profileId: z.string(),
  date: z.string().nullish(),
  value: z.number().nullish(),
  attemptId: z.string().nullish(),
  simulationId: z.string().nullish(),
  scenarioId: z.string().nullish(),
  count: z.number().nullish(),
});

export type DataPoint = z.infer<typeof DataPointSchema>;

/**
 * Standard metric response
 */
export const MetricResponseSchema = z.object({
  hasData: z.boolean(),
  method: MethodSchema,
  currentValue: z.number(),
  trendAnalysis: z.string().nullable().optional(),
  valueField: z.string().nullish(),
  keyField: z.string().nullish(),
  trendData: z.array(TrendDataSchema),
  dataPoints: z.array(DataPointSchema),
});

export type MetricResponse = z.infer<typeof MetricResponseSchema>;
