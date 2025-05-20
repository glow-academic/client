// utils/queries/get-all-chats.ts
"use server"
import { eq } from 'drizzle-orm';
import { chats } from '@/drizzle/schema';
import { db } from '@/utils/drizzle/database';

export async function getAllChats() {
    const allChats = await db.select().from(chats);
    return allChats;
}
