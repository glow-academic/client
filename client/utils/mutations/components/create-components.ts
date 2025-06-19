// utils/mutations/components/create-components.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { components } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createComponents(data: (typeof components.$inferInsert)[]) {
  try {
    return await db.insert(components).values(data).returning();
  } catch (error) {
    logError("Error creating multiple components:", error);
    throw error;
  }
}
