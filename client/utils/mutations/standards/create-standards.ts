// utils/mutations/standards/create-standards.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { standards } from "@/drizzle/schema";

export async function createStandards(data: (typeof standards.$inferInsert)[]) {
  try {
    return await db.insert(standards).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple standards:", error);
    throw error;
  }
}
