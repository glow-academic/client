import {
    pgTable,
    uuid,
    timestamp,
    text,
    boolean as pgBoolean,
    integer,
    pgEnum,
    numeric,
  } from "drizzle-orm/pg-core";
  
  // reuse the DB enum
  export const chatProfile = pgEnum("chat_profile", [
    "aggressive",
    "shy",
    "happy",
  ]);
  
  export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    username: text("username").notNull().unique(),
    password: text("password").notNull(),
  });
  
  export const chats = pgTable("chats", {
    id: uuid("id").defaultRandom().primaryKey(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    title: text("title").notNull(),
    completed: pgBoolean("completed").default(false).notNull(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id),
    profile: chatProfile("profile").notNull(),
  });
  
  export const messages = pgTable("messages", {
    id: uuid("id").defaultRandom().primaryKey(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    chat_id: uuid("chat_id").notNull().references(() => chats.id),
    query: text("query").notNull(),
    response: text("response").notNull(),
    completed: pgBoolean("completed").default(false).notNull(),
  });
  
  export const rubrics = pgTable("rubrics", {
    id: uuid("id").primaryKey().references(() => chats.id),
    created_at: timestamp("created_at").defaultNow().notNull(),
    passed: pgBoolean("passed").notNull(),
    support: numeric("support").notNull(),
    elaborated: numeric("elaborated").notNull(),
    time: integer("time").notNull(),
  });
  