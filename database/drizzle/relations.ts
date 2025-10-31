import { relations } from "drizzle-orm/relations";
import { providers, models, profiles, profileRequestLimits, profileActivity, providerEndpoints, rubrics, standardGroups, standards, assistantChats, assistantMessages, assistantToolCalls, personas, agents, modelRuns, debugInfo, parameters, parameterItems, scenarios, scenarioProblemStatements, simulations, simulationTimeLimits, simulationAttempts, simulationChats, simulationChatGrades, simulationMessages, simulationChatFeedbacks, scenarioObjectives, simulationHints, documents, documentDepartments, departments, rubricDepartments, prompts, promptDepartments, personaDepartments, personaPrompts, modelRunModels, modelRunPersonas, modelRunAgents, modelRunProfiles, agentDepartments, agentPrompts, parameterItemDepartments, scenarioDepartments, scenarioPersonas, scenarioParameterItems, scenarioDocuments, documentParameterItems, scenarioTree, simulationDepartments, attemptProfiles, cohorts, cohortProfiles, cohortSimulations, cohortDepartments, profileDepartments, appFeedback, appFeedbackProfiles, simulationScenarios } from "./schema";

export const modelsRelations = relations(models, ({one, many}) => ({
	provider: one(providers, {
		fields: [models.providerId],
		references: [providers.id]
	}),
	personas: many(personas),
	agents: many(agents),
	modelRunModels: many(modelRunModels),
}));

export const providersRelations = relations(providers, ({many}) => ({
	models: many(models),
	providerEndpoints: many(providerEndpoints),
}));

export const profileRequestLimitsRelations = relations(profileRequestLimits, ({one}) => ({
	profile: one(profiles, {
		fields: [profileRequestLimits.profileId],
		references: [profiles.id]
	}),
}));

export const profilesRelations = relations(profiles, ({many}) => ({
	profileRequestLimits: many(profileRequestLimits),
	profileActivities: many(profileActivity),
	assistantChats: many(assistantChats),
	modelRunProfiles: many(modelRunProfiles),
	attemptProfiles: many(attemptProfiles),
	cohortProfiles: many(cohortProfiles),
	profileDepartments: many(profileDepartments),
	appFeedbackProfiles: many(appFeedbackProfiles),
}));

export const profileActivityRelations = relations(profileActivity, ({one}) => ({
	profile: one(profiles, {
		fields: [profileActivity.profileId],
		references: [profiles.id]
	}),
}));

export const providerEndpointsRelations = relations(providerEndpoints, ({one}) => ({
	provider: one(providers, {
		fields: [providerEndpoints.providerId],
		references: [providers.id]
	}),
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
	simulations: many(simulations),
	simulationChatGrades: many(simulationChatGrades),
	rubricDepartments: many(rubricDepartments),
}));

export const standardsRelations = relations(standards, ({one, many}) => ({
	standardGroup: one(standardGroups, {
		fields: [standards.standardGroupId],
		references: [standardGroups.id]
	}),
	simulationChatFeedbacks: many(simulationChatFeedbacks),
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
	personaDepartments: many(personaDepartments),
	personaPrompts: many(personaPrompts),
	modelRunPersonas: many(modelRunPersonas),
	scenarioPersonas: many(scenarioPersonas),
}));

export const agentsRelations = relations(agents, ({one, many}) => ({
	model: one(models, {
		fields: [agents.modelId],
		references: [models.id]
	}),
	modelRunAgents: many(modelRunAgents),
	agentDepartments: many(agentDepartments),
	agentPrompts: many(agentPrompts),
}));

export const debugInfoRelations = relations(debugInfo, ({one}) => ({
	modelRun: one(modelRuns, {
		fields: [debugInfo.modelRunId],
		references: [modelRuns.id]
	}),
}));

export const modelRunsRelations = relations(modelRuns, ({many}) => ({
	debugInfos: many(debugInfo),
	modelRunModels: many(modelRunModels),
	modelRunPersonas: many(modelRunPersonas),
	modelRunAgents: many(modelRunAgents),
	modelRunProfiles: many(modelRunProfiles),
}));

export const parameterItemsRelations = relations(parameterItems, ({one, many}) => ({
	parameter: one(parameters, {
		fields: [parameterItems.parameterId],
		references: [parameters.id]
	}),
	parameterItemDepartments: many(parameterItemDepartments),
	scenarioParameterItems: many(scenarioParameterItems),
	documentParameterItems: many(documentParameterItems),
}));

export const parametersRelations = relations(parameters, ({many}) => ({
	parameterItems: many(parameterItems),
}));

export const scenarioProblemStatementsRelations = relations(scenarioProblemStatements, ({one}) => ({
	scenario: one(scenarios, {
		fields: [scenarioProblemStatements.scenarioId],
		references: [scenarios.id]
	}),
}));

export const scenariosRelations = relations(scenarios, ({many}) => ({
	scenarioProblemStatements: many(scenarioProblemStatements),
	simulationChats: many(simulationChats),
	scenarioObjectives: many(scenarioObjectives),
	scenarioDepartments: many(scenarioDepartments),
	scenarioPersonas: many(scenarioPersonas),
	scenarioParameterItems: many(scenarioParameterItems),
	scenarioDocuments: many(scenarioDocuments),
	scenarioTrees_parentId: many(scenarioTree, {
		relationName: "scenarioTree_parentId_scenarios_id"
	}),
	scenarioTrees_childId: many(scenarioTree, {
		relationName: "scenarioTree_childId_scenarios_id"
	}),
	simulationScenarios: many(simulationScenarios),
}));

export const simulationsRelations = relations(simulations, ({one, many}) => ({
	rubric: one(rubrics, {
		fields: [simulations.rubricId],
		references: [rubrics.id]
	}),
	simulationTimeLimits: many(simulationTimeLimits),
	simulationAttempts: many(simulationAttempts),
	simulationDepartments: many(simulationDepartments),
	cohortSimulations: many(cohortSimulations),
	simulationScenarios: many(simulationScenarios),
}));

export const simulationTimeLimitsRelations = relations(simulationTimeLimits, ({one}) => ({
	simulation: one(simulations, {
		fields: [simulationTimeLimits.simulationId],
		references: [simulations.id]
	}),
}));

export const simulationAttemptsRelations = relations(simulationAttempts, ({one, many}) => ({
	simulation: one(simulations, {
		fields: [simulationAttempts.simulationId],
		references: [simulations.id]
	}),
	simulationChats: many(simulationChats),
	attemptProfiles: many(attemptProfiles),
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
	simulationChatGrades: many(simulationChatGrades),
	simulationMessages: many(simulationMessages),
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

export const simulationMessagesRelations = relations(simulationMessages, ({one, many}) => ({
	simulationChat: one(simulationChats, {
		fields: [simulationMessages.chatId],
		references: [simulationChats.id]
	}),
	simulationHints: many(simulationHints),
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

export const scenarioObjectivesRelations = relations(scenarioObjectives, ({one}) => ({
	scenario: one(scenarios, {
		fields: [scenarioObjectives.scenarioId],
		references: [scenarios.id]
	}),
}));

export const simulationHintsRelations = relations(simulationHints, ({one}) => ({
	simulationMessage: one(simulationMessages, {
		fields: [simulationHints.simulationMessageId],
		references: [simulationMessages.id]
	}),
}));

export const documentDepartmentsRelations = relations(documentDepartments, ({one}) => ({
	document: one(documents, {
		fields: [documentDepartments.documentId],
		references: [documents.id]
	}),
	department: one(departments, {
		fields: [documentDepartments.departmentId],
		references: [departments.id]
	}),
}));

export const documentsRelations = relations(documents, ({many}) => ({
	documentDepartments: many(documentDepartments),
	scenarioDocuments: many(scenarioDocuments),
	documentParameterItems: many(documentParameterItems),
}));

export const departmentsRelations = relations(departments, ({many}) => ({
	documentDepartments: many(documentDepartments),
	rubricDepartments: many(rubricDepartments),
	promptDepartments: many(promptDepartments),
	personaDepartments: many(personaDepartments),
	agentDepartments: many(agentDepartments),
	parameterItemDepartments: many(parameterItemDepartments),
	scenarioDepartments: many(scenarioDepartments),
	simulationDepartments: many(simulationDepartments),
	cohortDepartments: many(cohortDepartments),
	profileDepartments: many(profileDepartments),
}));

export const rubricDepartmentsRelations = relations(rubricDepartments, ({one}) => ({
	rubric: one(rubrics, {
		fields: [rubricDepartments.rubricId],
		references: [rubrics.id]
	}),
	department: one(departments, {
		fields: [rubricDepartments.departmentId],
		references: [departments.id]
	}),
}));

export const promptDepartmentsRelations = relations(promptDepartments, ({one}) => ({
	prompt: one(prompts, {
		fields: [promptDepartments.promptId],
		references: [prompts.id]
	}),
	department: one(departments, {
		fields: [promptDepartments.departmentId],
		references: [departments.id]
	}),
}));

export const promptsRelations = relations(prompts, ({many}) => ({
	promptDepartments: many(promptDepartments),
	personaPrompts: many(personaPrompts),
	agentPrompts: many(agentPrompts),
}));

export const personaDepartmentsRelations = relations(personaDepartments, ({one}) => ({
	persona: one(personas, {
		fields: [personaDepartments.personaId],
		references: [personas.id]
	}),
	department: one(departments, {
		fields: [personaDepartments.departmentId],
		references: [departments.id]
	}),
}));

export const personaPromptsRelations = relations(personaPrompts, ({one}) => ({
	persona: one(personas, {
		fields: [personaPrompts.personaId],
		references: [personas.id]
	}),
	prompt: one(prompts, {
		fields: [personaPrompts.promptId],
		references: [prompts.id]
	}),
}));

export const modelRunModelsRelations = relations(modelRunModels, ({one}) => ({
	modelRun: one(modelRuns, {
		fields: [modelRunModels.modelRunId],
		references: [modelRuns.id]
	}),
	model: one(models, {
		fields: [modelRunModels.modelId],
		references: [models.id]
	}),
}));

export const modelRunPersonasRelations = relations(modelRunPersonas, ({one}) => ({
	modelRun: one(modelRuns, {
		fields: [modelRunPersonas.modelRunId],
		references: [modelRuns.id]
	}),
	persona: one(personas, {
		fields: [modelRunPersonas.personaId],
		references: [personas.id]
	}),
}));

export const modelRunAgentsRelations = relations(modelRunAgents, ({one}) => ({
	modelRun: one(modelRuns, {
		fields: [modelRunAgents.modelRunId],
		references: [modelRuns.id]
	}),
	agent: one(agents, {
		fields: [modelRunAgents.agentId],
		references: [agents.id]
	}),
}));

export const modelRunProfilesRelations = relations(modelRunProfiles, ({one}) => ({
	modelRun: one(modelRuns, {
		fields: [modelRunProfiles.modelRunId],
		references: [modelRuns.id]
	}),
	profile: one(profiles, {
		fields: [modelRunProfiles.profileId],
		references: [profiles.id]
	}),
}));

export const agentDepartmentsRelations = relations(agentDepartments, ({one}) => ({
	agent: one(agents, {
		fields: [agentDepartments.agentId],
		references: [agents.id]
	}),
	department: one(departments, {
		fields: [agentDepartments.departmentId],
		references: [departments.id]
	}),
}));

export const agentPromptsRelations = relations(agentPrompts, ({one}) => ({
	agent: one(agents, {
		fields: [agentPrompts.agentId],
		references: [agents.id]
	}),
	prompt: one(prompts, {
		fields: [agentPrompts.promptId],
		references: [prompts.id]
	}),
}));

export const parameterItemDepartmentsRelations = relations(parameterItemDepartments, ({one}) => ({
	parameterItem: one(parameterItems, {
		fields: [parameterItemDepartments.parameterItemId],
		references: [parameterItems.id]
	}),
	department: one(departments, {
		fields: [parameterItemDepartments.departmentId],
		references: [departments.id]
	}),
}));

export const scenarioDepartmentsRelations = relations(scenarioDepartments, ({one}) => ({
	scenario: one(scenarios, {
		fields: [scenarioDepartments.scenarioId],
		references: [scenarios.id]
	}),
	department: one(departments, {
		fields: [scenarioDepartments.departmentId],
		references: [departments.id]
	}),
}));

export const scenarioPersonasRelations = relations(scenarioPersonas, ({one}) => ({
	scenario: one(scenarios, {
		fields: [scenarioPersonas.scenarioId],
		references: [scenarios.id]
	}),
	persona: one(personas, {
		fields: [scenarioPersonas.personaId],
		references: [personas.id]
	}),
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

export const documentParameterItemsRelations = relations(documentParameterItems, ({one}) => ({
	document: one(documents, {
		fields: [documentParameterItems.documentId],
		references: [documents.id]
	}),
	parameterItem: one(parameterItems, {
		fields: [documentParameterItems.parameterItemId],
		references: [parameterItems.id]
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

export const simulationDepartmentsRelations = relations(simulationDepartments, ({one}) => ({
	simulation: one(simulations, {
		fields: [simulationDepartments.simulationId],
		references: [simulations.id]
	}),
	department: one(departments, {
		fields: [simulationDepartments.departmentId],
		references: [departments.id]
	}),
}));

export const attemptProfilesRelations = relations(attemptProfiles, ({one}) => ({
	simulationAttempt: one(simulationAttempts, {
		fields: [attemptProfiles.attemptId],
		references: [simulationAttempts.id]
	}),
	profile: one(profiles, {
		fields: [attemptProfiles.profileId],
		references: [profiles.id]
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

export const cohortsRelations = relations(cohorts, ({many}) => ({
	cohortProfiles: many(cohortProfiles),
	cohortSimulations: many(cohortSimulations),
	cohortDepartments: many(cohortDepartments),
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

export const cohortDepartmentsRelations = relations(cohortDepartments, ({one}) => ({
	cohort: one(cohorts, {
		fields: [cohortDepartments.cohortId],
		references: [cohorts.id]
	}),
	department: one(departments, {
		fields: [cohortDepartments.departmentId],
		references: [departments.id]
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

export const appFeedbackProfilesRelations = relations(appFeedbackProfiles, ({one}) => ({
	appFeedback: one(appFeedback, {
		fields: [appFeedbackProfiles.appFeedbackId],
		references: [appFeedback.id]
	}),
	profile: one(profiles, {
		fields: [appFeedbackProfiles.profileId],
		references: [profiles.id]
	}),
}));

export const appFeedbackRelations = relations(appFeedback, ({many}) => ({
	appFeedbackProfiles: many(appFeedbackProfiles),
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