// utils/queries/documents/get-all-documents.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { documents } from "@/drizzle/schema";

export async function getAllDocuments() {
  try {
    return await db.select().from(documents);
  } catch (error) {
    console.error("Error fetching all documents:", error);
    throw error;
  }
}
