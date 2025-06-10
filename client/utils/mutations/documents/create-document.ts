// utils/mutations/documents/create-document.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { documents } from "@/drizzle/schema";

export async function createDocument(data: typeof documents.$inferInsert) {
  try {
    const result = await db.insert(documents).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating document:", error);
    throw error;
  }
}
