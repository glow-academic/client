import { relations } from "drizzle-orm/relations";
import { classes, topics, rubrics, standardGroups, assistantChats, assistantToolCalls, assistantMessages, schedules, events, documents, users, profiles, standards } from "./schema";

export const topicsRelations = relations(topics, ({one}) => ({
	class: one(classes, {
		fields: [topics.classId],
		references: [classes.id]
	}),
}));

export const classesRelations = relations(classes, ({many}) => ({
	topics: many(topics),
	schedules: many(schedules),
	documents: many(documents),
}));

export const standardGroupsRelations = relations(standardGroups, ({one, many}) => ({
	rubric: one(rubrics, {
		fields: [standardGroups.rubricId],
		references: [rubrics.id]
	}),
	standards: many(standards),
}));

export const rubricsRelations = relations(rubrics, ({many}) => ({
	standardGroups: many(standardGroups),
}));

export const assistantToolCallsRelations = relations(assistantToolCalls, ({one}) => ({
	assistantChat: one(assistantChats, {
		fields: [assistantToolCalls.chatId],
		references: [assistantChats.id]
	}),
	assistantMessage: one(assistantMessages, {
		fields: [assistantToolCalls.messageId],
		references: [assistantMessages.id]
	}),
}));

export const assistantChatsRelations = relations(assistantChats, ({one, many}) => ({
	assistantToolCalls: many(assistantToolCalls),
	assistantMessages: many(assistantMessages),
	profile: one(profiles, {
		fields: [assistantChats.profileId],
		references: [profiles.id]
	}),
}));

export const assistantMessagesRelations = relations(assistantMessages, ({one, many}) => ({
	assistantToolCalls: many(assistantToolCalls),
	assistantChat: one(assistantChats, {
		fields: [assistantMessages.chatId],
		references: [assistantChats.id]
	}),
}));

export const schedulesRelations = relations(schedules, ({one, many}) => ({
	class: one(classes, {
		fields: [schedules.classId],
		references: [classes.id]
	}),
	events: many(events),
}));

export const eventsRelations = relations(events, ({one}) => ({
	schedule: one(schedules, {
		fields: [events.scheduleId],
		references: [schedules.id]
	}),
}));

export const documentsRelations = relations(documents, ({one}) => ({
	class: one(classes, {
		fields: [documents.classId],
		references: [classes.id]
	}),
}));

export const profilesRelations = relations(profiles, ({one, many}) => ({
	user: one(users, {
		fields: [profiles.userId],
		references: [users.id]
	}),
	assistantChats: many(assistantChats),
}));

export const usersRelations = relations(users, ({many}) => ({
	profiles: many(profiles),
}));

export const standardsRelations = relations(standards, ({one}) => ({
	standardGroup: one(standardGroups, {
		fields: [standards.standardGroupId],
		references: [standardGroups.id]
	}),
}));