// utils/queries/get-rubrics.ts
"use server"
import { eq, inArray } from 'drizzle-orm';
import { rubrics } from '@/drizzle/schema';
import { drizzle } from 'drizzle-orm/postgres-js';

export async function getRubrics(chatIds: string[]) {
    const db = drizzle(process.env.DATABASE_URL!);

    const chatRubrics = await db.select().from(rubrics).where(inArray(rubrics.id, chatIds));
    return chatRubrics;
}
