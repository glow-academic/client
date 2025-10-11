import { relations } from "drizzle-orm/relations";
import { users, profiles, departments, providers, models, documents, rubrics, standardGroups, standards, appFeedback, assistantChats, assistantMessages, assistantToolCalls, personas, agents, modelRuns, debugInfo, parameters, parameterItems, scenarios, simulations, simulationAttempts, simulationChats, simulationMessages, simulationHints, simulationChatGrades, simulationChatFeedbacks, cohorts, scenarioParameterItems, scenarioDocuments, scenarioTree, cohortProfiles, cohortSimulations, departmentAgents, scenarioObjectives, simulationScenarios, simulationTags, simulationTagDocuments, simulationTagParameterItems, profileDepartments } from "./schema";

export const profilesRelations = relations(profiles, ({one, many}) => ({
	user: one(users, {
		fields: [profiles.userId],
		references: [users.id]
	}),
	appFeedbacks: many(appFeedback),
	assistantChats: many(assistantChats),
	modelRuns: many(modelRuns),
	simulationAttempts: many(simulationAttempts),
	cohortProfiles: many(cohortProfiles),
	profileDepartments: many(profileDepartments),
}));

export const usersRelations = relations(users, ({many}) => ({
	profiles: many(profiles),
}));

export const providersRelations = relations(providers, ({one, many}) => ({
	department: one(departments, {
		fields: [providers.departmentId],
		references: [departments.id]
	}),
	models: many(models),
}));

export const departmentsRelations = relations(departments, ({many}) => ({
	providers: many(providers),
	documents: many(documents),
	rubrics: many(rubrics),
	personas: many(personas),
	modelRuns: many(modelRuns),
	parameters: many(parameters),
	scenarios: many(scenarios),
	simulations: many(simulations),
	cohorts: many(cohorts),
	departmentAgents: many(departmentAgents),
	profileDepartments: many(profileDepartments),
}));

export const modelsRelations = relations(models, ({one, many}) => ({
	provider: one(providers, {
		fields: [models.providerId],
		references: [providers.id]
	}),
	personas: many(personas),
	agents: many(agents),
	modelRuns: many(modelRuns),
}));

export const documentsRelations = relations(documents, ({one, many}) => ({
	department: one(departments, {
		fields: [documents.departmentId],
		references: [departments.id]
	}),
	scenarioDocuments: many(scenarioDocuments),
	simulationTagDocuments: many(simulationTagDocuments),
}));

export const rubricsRelations = relations(rubrics, ({one, many}) => ({
	department: one(departments, {
		fields: [rubrics.departmentId],
		references: [departments.id]
	}),
	standardGroups: many(standardGroups),
	simulations: many(simulations),
	simulationChatGrades: many(simulationChatGrades),
}));

export const standardGroupsRelations = relations(standardGroups, ({one, many}) => ({
	rubric: one(rubrics, {
		fields: [standardGroups.rubricId],
		references: [rubrics.id]
	}),
	standards: many(standards),
}));

export const standardsRelations = relations(standards, ({one, many}) => ({
	standardGroup: one(standardGroups, {
		fields: [standards.standardGroupId],
		references: [standardGroups.id]
	}),
	simulationChatFeedbacks: many(simulationChatFeedbacks),
}));

export const appFeedbackRelations = relations(appFeedback, ({one}) => ({
	profile: one(profiles, {
		fields: [appFeedback.profileId],
		references: [profiles.id]
	}),
}));

export const assistantChatsRelations = relations(assistantChats, ({one, many}) => ({
	profile: one(profiles, {
		fields: [assistantChats.profileId],
		references: [profiles.id]
	}),
	assistantMessages: many(assistantMessages),
	assistantToolCalls: many(assistantToolCalls),
}));

export const assistantMessagesRelations = relations(assistantMessages, ({one}) => ({
	assistantChat: one(assistantChats, {
		fields: [assistantMessages.chatId],
		references: [assistantChats.id]
	}),
}));

export const assistantToolCallsRelations = relations(assistantToolCalls, ({one}) => ({
	assistantChat: one(assistantChats, {
		fields: [assistantToolCalls.chatId],
		references: [assistantChats.id]
	}),
}));

export const personasRelations = relations(personas, ({one, many}) => ({
	model: one(models, {
		fields: [personas.modelId],
		references: [models.id]
	}),
	department: one(departments, {
		fields: [personas.departmentId],
		references: [departments.id]
	}),
	modelRuns: many(modelRuns),
	scenarios: many(scenarios),
}));

export const agentsRelations = relations(agents, ({one, many}) => ({
	model: one(models, {
		fields: [agents.modelId],
		references: [models.id]
	}),
	modelRuns: many(modelRuns),
	departmentAgents: many(departmentAgents),
}));

export const modelRunsRelations = relations(modelRuns, ({one, many}) => ({
	model: one(models, {
		fields: [modelRuns.modelId],
		references: [models.id]
	}),
	persona: one(personas, {
		fields: [modelRuns.personaId],
		references: [personas.id]
	}),
	agent: one(agents, {
		fields: [modelRuns.agentId],
		references: [agents.id]
	}),
	profile: one(profiles, {
		fields: [modelRuns.profileId],
		references: [profiles.id]
	}),
	department: one(departments, {
		fields: [modelRuns.departmentId],
		references: [departments.id]
	}),
	debugInfos: many(debugInfo),
}));

export const debugInfoRelations = relations(debugInfo, ({one}) => ({
	modelRun: one(modelRuns, {
		fields: [debugInfo.modelRunId],
		references: [modelRuns.id]
	}),
}));

export const parametersRelations = relations(parameters, ({one, many}) => ({
	department: one(departments, {
		fields: [parameters.departmentId],
		references: [departments.id]
	}),
	parameterItems: many(parameterItems),
}));

export const parameterItemsRelations = relations(parameterItems, ({one, many}) => ({
	parameter: one(parameters, {
		fields: [parameterItems.parameterId],
		references: [parameters.id]
	}),
	scenarioParameterItems: many(scenarioParameterItems),
	simulationTagParameterItems: many(simulationTagParameterItems),
}));

export const scenariosRelations = relations(scenarios, ({one, many}) => ({
	persona: one(personas, {
		fields: [scenarios.personaId],
		references: [personas.id]
	}),
	department: one(departments, {
		fields: [scenarios.departmentId],
		references: [departments.id]
	}),
	simulationChats: many(simulationChats),
	scenarioParameterItems: many(scenarioParameterItems),
	scenarioDocuments: many(scenarioDocuments),
	scenarioTrees_parentId: many(scenarioTree, {
		relationName: "scenarioTree_parentId_scenarios_id"
	}),
	scenarioTrees_childId: many(scenarioTree, {
		relationName: "scenarioTree_childId_scenarios_id"
	}),
	scenarioObjectives: many(scenarioObjectives),
	simulationScenarios: many(simulationScenarios),
}));

export const simulationsRelations = relations(simulations, ({one, many}) => ({
	rubric: one(rubrics, {
		fields: [simulations.rubricId],
		references: [rubrics.id]
	}),
	department: one(departments, {
		fields: [simulations.departmentId],
		references: [departments.id]
	}),
	simulationAttempts: many(simulationAttempts),
	cohortSimulations: many(cohortSimulations),
	simulationScenarios: many(simulationScenarios),
	simulationTags: many(simulationTags),
}));

export const simulationAttemptsRelations = relations(simulationAttempts, ({one, many}) => ({
	profile: one(profiles, {
		fields: [simulationAttempts.profileId],
		references: [profiles.id]
	}),
	simulation: one(simulations, {
		fields: [simulationAttempts.simulationId],
		references: [simulations.id]
	}),
	simulationChats: many(simulationChats),
}));

export const simulationChatsRelations = relations(simulationChats, ({one, many}) => ({
	scenario: one(scenarios, {
		fields: [simulationChats.scenarioId],
		references: [scenarios.id]
	}),
	simulationAttempt: one(simulationAttempts, {
		fields: [simulationChats.attemptId],
		references: [simulationAttempts.id]
	}),
	simulationMessages: many(simulationMessages),
	simulationChatGrades: many(simulationChatGrades),
}));

export const simulationMessagesRelations = relations(simulationMessages, ({one, many}) => ({
	simulationChat: one(simulationChats, {
		fields: [simulationMessages.chatId],
		references: [simulationChats.id]
	}),
	simulationHints: many(simulationHints),
}));

export const simulationHintsRelations = relations(simulationHints, ({one}) => ({
	simulationMessage: one(simulationMessages, {
		fields: [simulationHints.simulationMessageId],
		references: [simulationMessages.id]
	}),
}));

export const simulationChatGradesRelations = relations(simulationChatGrades, ({one, many}) => ({
	rubric: one(rubrics, {
		fields: [simulationChatGrades.rubricId],
		references: [rubrics.id]
	}),
	simulationChat: one(simulationChats, {
		fields: [simulationChatGrades.simulationChatId],
		references: [simulationChats.id]
	}),
	simulationChatFeedbacks: many(simulationChatFeedbacks),
}));

export const simulationChatFeedbacksRelations = relations(simulationChatFeedbacks, ({one}) => ({
	standard: one(standards, {
		fields: [simulationChatFeedbacks.standardId],
		references: [standards.id]
	}),
	simulationChatGrade: one(simulationChatGrades, {
		fields: [simulationChatFeedbacks.simulationChatGradeId],
		references: [simulationChatGrades.id]
	}),
}));

export const cohortsRelations = relations(cohorts, ({one, many}) => ({
	department: one(departments, {
		fields: [cohorts.departmentId],
		references: [departments.id]
	}),
	cohortProfiles: many(cohortProfiles),
	cohortSimulations: many(cohortSimulations),
}));

export const scenarioParameterItemsRelations = relations(scenarioParameterItems, ({one}) => ({
	scenario: one(scenarios, {
		fields: [scenarioParameterItems.scenarioId],
		references: [scenarios.id]
	}),
	parameterItem: one(parameterItems, {
		fields: [scenarioParameterItems.parameterItemId],
		references: [parameterItems.id]
	}),
}));

export const scenarioDocumentsRelations = relations(scenarioDocuments, ({one}) => ({
	scenario: one(scenarios, {
		fields: [scenarioDocuments.scenarioId],
		references: [scenarios.id]
	}),
	document: one(documents, {
		fields: [scenarioDocuments.documentId],
		references: [documents.id]
	}),
}));

export const scenarioTreeRelations = relations(scenarioTree, ({one}) => ({
	scenario_parentId: one(scenarios, {
		fields: [scenarioTree.parentId],
		references: [scenarios.id],
		relationName: "scenarioTree_parentId_scenarios_id"
	}),
	scenario_childId: one(scenarios, {
		fields: [scenarioTree.childId],
		references: [scenarios.id],
		relationName: "scenarioTree_childId_scenarios_id"
	}),
}));

export const cohortProfilesRelations = relations(cohortProfiles, ({one}) => ({
	cohort: one(cohorts, {
		fields: [cohortProfiles.cohortId],
		references: [cohorts.id]
	}),
	profile: one(profiles, {
		fields: [cohortProfiles.profileId],
		references: [profiles.id]
	}),
}));

export const cohortSimulationsRelations = relations(cohortSimulations, ({one}) => ({
	cohort: one(cohorts, {
		fields: [cohortSimulations.cohortId],
		references: [cohorts.id]
	}),
	simulation: one(simulations, {
		fields: [cohortSimulations.simulationId],
		references: [simulations.id]
	}),
}));

export const departmentAgentsRelations = relations(departmentAgents, ({one}) => ({
	department: one(departments, {
		fields: [departmentAgents.departmentId],
		references: [departments.id]
	}),
	agent: one(agents, {
		fields: [departmentAgents.agentId],
		references: [agents.id]
	}),
}));

export const scenarioObjectivesRelations = relations(scenarioObjectives, ({one}) => ({
	scenario: one(scenarios, {
		fields: [scenarioObjectives.scenarioId],
		references: [scenarios.id]
	}),
}));

export const simulationScenariosRelations = relations(simulationScenarios, ({one}) => ({
	simulation: one(simulations, {
		fields: [simulationScenarios.simulationId],
		references: [simulations.id]
	}),
	scenario: one(scenarios, {
		fields: [simulationScenarios.scenarioId],
		references: [scenarios.id]
	}),
}));

export const simulationTagsRelations = relations(simulationTags, ({one, many}) => ({
	simulation: one(simulations, {
		fields: [simulationTags.simulationId],
		references: [simulations.id]
	}),
	simulationTagDocuments: many(simulationTagDocuments),
	simulationTagParameterItems: many(simulationTagParameterItems),
}));

export const simulationTagDocumentsRelations = relations(simulationTagDocuments, ({one}) => ({
	document: one(documents, {
		fields: [simulationTagDocuments.documentId],
		references: [documents.id]
	}),
	simulationTag: one(simulationTags, {
		fields: [simulationTagDocuments.simulationId],
		references: [simulationTags.simulationId]
	}),
}));

export const simulationTagParameterItemsRelations = relations(simulationTagParameterItems, ({one}) => ({
	parameterItem: one(parameterItems, {
		fields: [simulationTagParameterItems.parameterItemId],
		references: [parameterItems.id]
	}),
	simulationTag: one(simulationTags, {
		fields: [simulationTagParameterItems.simulationId],
		references: [simulationTags.simulationId]
	}),
}));

export const profileDepartmentsRelations = relations(profileDepartments, ({one}) => ({
	profile: one(profiles, {
		fields: [profileDepartments.profileId],
		references: [profiles.id]
	}),
	department: one(departments, {
		fields: [profileDepartments.departmentId],
		references: [departments.id]
	}),
}));