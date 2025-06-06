// utils/queries/get-agents.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { agents } from "@/drizzle/schema";

export async function getAgents() {
  const fetchedAgents = await db.select().from(agents);
  return fetchedAgents;
}
