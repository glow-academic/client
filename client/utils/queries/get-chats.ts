// utils/queries/get-chats.ts
"use server"
import { eq } from 'drizzle-orm';
import { chats } from '@/drizzle/schema';
import { drizzle } from 'drizzle-orm/postgres-js';

export async function getChats(userId: string) {
    const db = drizzle(process.env.DATABASE_URL!);

    const userChats = await db.select().from(chats).where(eq(chats.user_id, userId));
    return userChats;
}
