// utils/queries/documents/get-all-documents.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { documents } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllDocuments() {
  try {
    return await db.select().from(documents);
  } catch (error) {
    logError("Error fetching all documents:", error);
    throw error;
  }
}
