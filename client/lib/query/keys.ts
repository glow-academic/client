// AUTO-GENERATED from OpenAPI spec. Do not edit.
// Generated from: server/openapi.json

const stable = (v: unknown): string =>
  v && typeof v === "object"
    ? JSON.stringify(v, Object.keys(v as Record<string, unknown>).sort())
    : String(v ?? "");

export const keys = {
  agents: Object.assign(
    (p?: Record<string, unknown>) => p ? ["agents", "with", stable(p)] as const : ["agents"] as const,
    {
      all: ["agents"] as const,
      with: (p: Record<string, unknown>) => ["agents", "with", stable(p)] as const,
      list: (filters?: Record<string, unknown>) => filters ? ["agents", "list", stable(filters)] as const : ["agents", "list"] as const,
    }
  ),
  analytics: Object.assign(
    (p?: Record<string, unknown>) => p ? ["analytics", "with", stable(p)] as const : ["analytics"] as const,
    {
      all: ["analytics"] as const,
      with: (p: Record<string, unknown>) => ["analytics", "with", stable(p)] as const,
    }
  ),
  assistant: Object.assign(
    (p?: Record<string, unknown>) => p ? ["assistant", "with", stable(p)] as const : ["assistant"] as const,
    {
      all: ["assistant"] as const,
      with: (p: Record<string, unknown>) => ["assistant", "with", stable(p)] as const,
      list: (filters?: Record<string, unknown>) => filters ? ["assistant", "list", stable(filters)] as const : ["assistant", "list"] as const,
    }
  ),
  attempts: Object.assign(
    (p?: Record<string, unknown>) => p ? ["attempts", "with", stable(p)] as const : ["attempts"] as const,
    {
      all: ["attempts"] as const,
      with: (p: Record<string, unknown>) => ["attempts", "with", stable(p)] as const,
    }
  ),
  cohorts: Object.assign(
    (p?: Record<string, unknown>) => p ? ["cohorts", "with", stable(p)] as const : ["cohorts"] as const,
    {
      all: ["cohorts"] as const,
      with: (p: Record<string, unknown>) => ["cohorts", "with", stable(p)] as const,
      list: (filters?: Record<string, unknown>) => filters ? ["cohorts", "list", stable(filters)] as const : ["cohorts", "list"] as const,
    }
  ),
  dashboard: Object.assign(
    (p?: Record<string, unknown>) => p ? ["dashboard", "with", stable(p)] as const : ["dashboard"] as const,
    {
      all: ["dashboard"] as const,
      with: (p: Record<string, unknown>) => ["dashboard", "with", stable(p)] as const,
    }
  ),
  departments: Object.assign(
    (p?: Record<string, unknown>) => p ? ["departments", "with", stable(p)] as const : ["departments"] as const,
    {
      all: ["departments"] as const,
      with: (p: Record<string, unknown>) => ["departments", "with", stable(p)] as const,
      list: (filters?: Record<string, unknown>) => filters ? ["departments", "list", stable(filters)] as const : ["departments", "list"] as const,
    }
  ),
  documents: Object.assign(
    (p?: Record<string, unknown>) => p ? ["documents", "with", stable(p)] as const : ["documents"] as const,
    {
      all: ["documents"] as const,
      with: (p: Record<string, unknown>) => ["documents", "with", stable(p)] as const,
      list: (filters?: Record<string, unknown>) => filters ? ["documents", "list", stable(filters)] as const : ["documents", "list"] as const,
    }
  ),
  feedback: Object.assign(
    (p?: Record<string, unknown>) => p ? ["feedback", "with", stable(p)] as const : ["feedback"] as const,
    {
      all: ["feedback"] as const,
      with: (p: Record<string, unknown>) => ["feedback", "with", stable(p)] as const,
      list: (filters?: Record<string, unknown>) => filters ? ["feedback", "list", stable(filters)] as const : ["feedback", "list"] as const,
    }
  ),
  home: Object.assign(
    (p?: Record<string, unknown>) => p ? ["home", "with", stable(p)] as const : ["home"] as const,
    {
      all: ["home"] as const,
      with: (p: Record<string, unknown>) => ["home", "with", stable(p)] as const,
    }
  ),
  leaderboard: Object.assign(
    (p?: Record<string, unknown>) => p ? ["leaderboard", "with", stable(p)] as const : ["leaderboard"] as const,
    {
      all: ["leaderboard"] as const,
      with: (p: Record<string, unknown>) => ["leaderboard", "with", stable(p)] as const,
    }
  ),
  logs: Object.assign(
    (p?: Record<string, unknown>) => p ? ["logs", "with", stable(p)] as const : ["logs"] as const,
    {
      all: ["logs"] as const,
      with: (p: Record<string, unknown>) => ["logs", "with", stable(p)] as const,
      list: (filters?: Record<string, unknown>) => filters ? ["logs", "list", stable(filters)] as const : ["logs", "list"] as const,
    }
  ),
  parameters: Object.assign(
    (p?: Record<string, unknown>) => p ? ["parameters", "with", stable(p)] as const : ["parameters"] as const,
    {
      all: ["parameters"] as const,
      with: (p: Record<string, unknown>) => ["parameters", "with", stable(p)] as const,
      list: (filters?: Record<string, unknown>) => filters ? ["parameters", "list", stable(filters)] as const : ["parameters", "list"] as const,
    }
  ),
  personas: Object.assign(
    (p?: Record<string, unknown>) => p ? ["personas", "with", stable(p)] as const : ["personas"] as const,
    {
      all: ["personas"] as const,
      with: (p: Record<string, unknown>) => ["personas", "with", stable(p)] as const,
      list: (filters?: Record<string, unknown>) => filters ? ["personas", "list", stable(filters)] as const : ["personas", "list"] as const,
    }
  ),
  practice: Object.assign(
    (p?: Record<string, unknown>) => p ? ["practice", "with", stable(p)] as const : ["practice"] as const,
    {
      all: ["practice"] as const,
      with: (p: Record<string, unknown>) => ["practice", "with", stable(p)] as const,
    }
  ),
  pricing: Object.assign(
    (p?: Record<string, unknown>) => p ? ["pricing", "with", stable(p)] as const : ["pricing"] as const,
    {
      all: ["pricing"] as const,
      with: (p: Record<string, unknown>) => ["pricing", "with", stable(p)] as const,
    }
  ),
  profile: Object.assign(
    (p?: Record<string, unknown>) => p ? ["profile", "with", stable(p)] as const : ["profile"] as const,
    {
      all: ["profile"] as const,
      with: (p: Record<string, unknown>) => ["profile", "with", stable(p)] as const,
      list: (filters?: Record<string, unknown>) => filters ? ["profile", "list", stable(filters)] as const : ["profile", "list"] as const,
    }
  ),
  providers: Object.assign(
    (p?: Record<string, unknown>) => p ? ["providers", "with", stable(p)] as const : ["providers"] as const,
    {
      all: ["providers"] as const,
      with: (p: Record<string, unknown>) => ["providers", "with", stable(p)] as const,
      list: (filters?: Record<string, unknown>) => filters ? ["providers", "list", stable(filters)] as const : ["providers", "list"] as const,
    }
  ),
  reports: Object.assign(
    (p?: Record<string, unknown>) => p ? ["reports", "with", stable(p)] as const : ["reports"] as const,
    {
      all: ["reports"] as const,
      with: (p: Record<string, unknown>) => ["reports", "with", stable(p)] as const,
    }
  ),
  rubrics: Object.assign(
    (p?: Record<string, unknown>) => p ? ["rubrics", "with", stable(p)] as const : ["rubrics"] as const,
    {
      all: ["rubrics"] as const,
      with: (p: Record<string, unknown>) => ["rubrics", "with", stable(p)] as const,
      list: (filters?: Record<string, unknown>) => filters ? ["rubrics", "list", stable(filters)] as const : ["rubrics", "list"] as const,
    }
  ),
  scenarios: Object.assign(
    (p?: Record<string, unknown>) => p ? ["scenarios", "with", stable(p)] as const : ["scenarios"] as const,
    {
      all: ["scenarios"] as const,
      with: (p: Record<string, unknown>) => ["scenarios", "with", stable(p)] as const,
      list: (filters?: Record<string, unknown>) => filters ? ["scenarios", "list", stable(filters)] as const : ["scenarios", "list"] as const,
    }
  ),
  simulations: Object.assign(
    (p?: Record<string, unknown>) => p ? ["simulations", "with", stable(p)] as const : ["simulations"] as const,
    {
      all: ["simulations"] as const,
      with: (p: Record<string, unknown>) => ["simulations", "with", stable(p)] as const,
      list: (filters?: Record<string, unknown>) => filters ? ["simulations", "list", stable(filters)] as const : ["simulations", "list"] as const,
    }
  ),
  v3: Object.assign(
    (p?: Record<string, unknown>) => p ? ["v3", "with", stable(p)] as const : ["v3"] as const,
    {
      all: ["v3"] as const,
      with: (p: Record<string, unknown>) => ["v3", "with", stable(p)] as const,
      list: (filters?: Record<string, unknown>) => filters ? ["v3", "list", stable(filters)] as const : ["v3", "list"] as const,
    }
  ),
} as const;

export type CacheTag = keyof typeof keys;
