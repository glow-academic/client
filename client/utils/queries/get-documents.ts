// utils/queries/get-documents.ts
"use server"
import { documents } from '@/drizzle/schema';
import { db } from '@/utils/drizzle/database';

export async function getDocuments() {
    const fetchedDocuments = await db.select().from(documents);
    return fetchedDocuments;
}
