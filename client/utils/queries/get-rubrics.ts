// utils/queries/get-rubrics.ts
"use server"
import { eq, inArray } from 'drizzle-orm';
import { rubrics } from '@/drizzle/schema';
import { db } from '@/utils/drizzle/database';

export async function getRubrics(chatIds: string[]) {
    const chatRubrics = await db.select().from(rubrics).where(inArray(rubrics.id, chatIds));
    return chatRubrics;
}
