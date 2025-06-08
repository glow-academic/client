// utils/queries/get-all-documents.ts
"use server";
import { documents } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function getAllDocuments() {
  const fetchedDocuments = await db.select().from(documents);
  return fetchedDocuments;
}
