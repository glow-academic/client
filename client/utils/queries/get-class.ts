// utils/queries/get-class.ts
"use server"
import { db } from '@/utils/drizzle/database';
import { classes } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

export async function getClass(classId: string) {
    const userClass = await db.select().from(classes).where(eq(classes.id, classId));
    return userClass;
}
