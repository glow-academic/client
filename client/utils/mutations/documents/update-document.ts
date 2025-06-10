// utils/mutations/documents/update-document.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { documents } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateDocument(
  id: string,
  data: Partial<typeof documents.$inferInsert>,
) {
  try {
    const result = await db
      .update(documents)
      .set(data)
      .where(eq(documents.id, id))
      .returning();
    return result[0];
  } catch (error) {
    console.error("Error updating document:", error);
    throw error;
  }
}
