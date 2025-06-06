// utils/queries/get-agent.ts
"use server";
import { eq } from "drizzle-orm";
import { agents } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function getAgent(agentId: string) {
  const agent = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);
  return agent[0] || null;
}
