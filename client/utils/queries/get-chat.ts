// utils/queries/get-chat.ts
"use server"
import { eq } from 'drizzle-orm';
import { chats } from '@/drizzle/schema';
import { drizzle } from 'drizzle-orm/postgres-js';

export async function getChat(chatId: string) {
    const db = drizzle(process.env.DATABASE_URL!);

    const chat = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
    return chat[0] || null;
}
