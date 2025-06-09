// utils/mutations/standards/create-standard.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standards } from "@/drizzle/schema";

export async function createStandard(data: typeof standards.$inferInsert) {
  try {
    const result = await db.insert(standards).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating standard:", error);
    throw error;
  }
}
