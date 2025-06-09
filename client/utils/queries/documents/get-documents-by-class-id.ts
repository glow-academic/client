// utils/queries/documents/get-documents-by-classid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { documents } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getDocumentsByClassid(classidId: string) {
  try {
    return await db.select().from(documents).where(eq(documents.class_id, classidId));
  } catch (error) {
    console.error("Error fetching documents by classid:", error);
    throw error;
  }
}
