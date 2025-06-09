import { classes as Classes, attempts as Attempts, rubrics as Rubrics, agents as Agents, users as Users } from "@/drizzle/schema";

// Use Drizzle schema types
type User = typeof Users.$inferSelect;
type Class = typeof Classes.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type Attempt = typeof Attempts.$inferSelect;

export type { User, Class, Agent, Rubric, Attempt };