// utils/mutations/rubrics/create-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { rubrics } from "@/drizzle/schema";

export async function createRubrics(data: (typeof rubrics.$inferInsert)[]) {
  try {
    return await db.insert(rubrics).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple rubrics:", error);
    throw error;
  }
}
