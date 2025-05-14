// utils/queries/get-rubric.ts
"use server"
import { eq } from 'drizzle-orm';
import { rubrics } from '@/drizzle/schema';
import { drizzle } from 'drizzle-orm/postgres-js';

export async function getRubric(rubricId: string) {
    const db = drizzle(process.env.DATABASE_URL!);

    const rubric = await db.select().from(rubrics).where(eq(rubrics.id, rubricId)).limit(1);
    return rubric[0] || null;
}
