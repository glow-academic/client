// utils/queries/get-user.ts
"use server"
import { eq } from 'drizzle-orm';
import { users } from '@/drizzle/schema';
import { drizzle } from 'drizzle-orm/postgres-js';

export async function getUser(userId: string) {
    const db = drizzle(process.env.DATABASE_URL!);

    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user[0] || null;
}
