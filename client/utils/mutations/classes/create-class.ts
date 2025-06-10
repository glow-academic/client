// utils/mutations/classes/create-class.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { classes } from "@/drizzle/schema";

export async function createClass(data: typeof classes.$inferInsert) {
  try {
    const result = await db.insert(classes).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating class:", error);
    throw error;
  }
}
