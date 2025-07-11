// Type definitions
export type ModelType = "Agents" | "Documents" | "Classes" | "Seniority";

export interface Model {
  id: string;
  name: string;
  description: string;
  type: ModelType;
  strengths?: string;
}