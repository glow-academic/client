// utils/queries/documents/get-documents-by-classids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { documents } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getDocumentsByClassids(classidIds: string[]) {
  try {
    return await db.select().from(documents).where(inArray(documents.class_id, classidIds));
  } catch (error) {
    console.error("Error fetching documents by classids:", error);
    throw error;
  }
}
