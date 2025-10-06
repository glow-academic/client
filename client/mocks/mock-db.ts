import * as mockSchema from "./schema";
import { faker } from "@faker-js/faker";
import {
  createMockAgent,
  createMockAppFeedback,
  createMockAppLog,
  createMockAssistantChat,
  createMockAssistantMessage,
  createMockAssistantToolCall,
  createMockCohort,
  createMockDebugInfo,
  createMockDocument,
  createMockModelRun,
  createMockModel,
  createMockParameterItem,
  createMockParameter,
  createMockPersona,
  createMockProfile,
  createMockProvider,
  createMockRubric,
  createMockScenario,
  createMockSimulationAttempt,
  createMockSimulationChatCrowdsourcedFeedback,
  createMockSimulationChatFeedback,
  createMockSimulationChatGrade,
  createMockSimulationChat,
  createMockSimulationCrowdsourcedMessage,
  createMockSimulationMessage,
  createMockSimulation,
  createMockStandardGroup,
  createMockStandard,
} from "./factories";
import type {
  Agent,
  AppFeedback,
  AppLog,
  AssistantChat,
  AssistantMessage,
  AssistantToolCall,
  Cohort,
  DebugInfo,
  Document,
  ModelRun,
  Model,
  ParameterItem,
  Parameter,
  Persona,
  Profile,
  Provider,
  Rubric,
  Scenario,
  SimulationAttempt,
  SimulationChatCrowdsourcedFeedback,
  SimulationChatFeedback,
  SimulationChatGrade,
  SimulationChat,
  SimulationCrowdsourcedMessage,
  SimulationMessage,
  Simulation,
  StandardGroup,
  Standard,
} from "@/types";

// A type-safe, in-memory database for testing
export class MockDb {
  agents: Agent[];
  appFeedback: AppFeedback[];
  appLogs: AppLog[];
  assistantChats: AssistantChat[];
  assistantMessages: AssistantMessage[];
  assistantToolCalls: AssistantToolCall[];
  cohorts: Cohort[];
  debugInfo: DebugInfo[];
  documents: Document[];
  modelRuns: ModelRun[];
  models: Model[];
  parameterItems: ParameterItem[];
  parameters: Parameter[];
  personas: Persona[];
  profiles: Profile[];
  providers: Provider[];
  rubrics: Rubric[];
  scenarios: Scenario[];
  simulationAttempts: SimulationAttempt[];
  simulationChatCrowdsourcedFeedbacks: SimulationChatCrowdsourcedFeedback[];
  simulationChatFeedbacks: SimulationChatFeedback[];
  simulationChatGrades: SimulationChatGrade[];
  simulationChats: SimulationChat[];
  simulationCrowdsourcedMessages: SimulationCrowdsourcedMessage[];
  simulationMessages: SimulationMessage[];
  simulations: Simulation[];
  standardGroups: StandardGroup[];
  standards: Standard[];

  constructor() {
    // Create deep copies to ensure test isolation
    this.agents = JSON.parse(JSON.stringify(mockSchema.agents));
    this.appFeedback = JSON.parse(JSON.stringify(mockSchema.appFeedback));
    this.appLogs = JSON.parse(JSON.stringify(mockSchema.appLogs));
    this.assistantChats = JSON.parse(JSON.stringify(mockSchema.assistantChats));
    this.assistantMessages = JSON.parse(
      JSON.stringify(mockSchema.assistantMessages),
    );
    this.assistantToolCalls = JSON.parse(
      JSON.stringify(mockSchema.assistantToolCalls),
    );
    this.cohorts = JSON.parse(JSON.stringify(mockSchema.cohorts));
    this.debugInfo = JSON.parse(JSON.stringify(mockSchema.debugInfo));
    this.documents = JSON.parse(JSON.stringify(mockSchema.documents));
    this.modelRuns = JSON.parse(JSON.stringify(mockSchema.modelRuns));
    this.models = JSON.parse(JSON.stringify(mockSchema.models));
    this.parameterItems = JSON.parse(JSON.stringify(mockSchema.parameterItems));
    this.parameters = JSON.parse(JSON.stringify(mockSchema.parameters));
    this.personas = JSON.parse(JSON.stringify(mockSchema.personas));
    this.profiles = JSON.parse(JSON.stringify(mockSchema.profiles));
    this.providers = JSON.parse(JSON.stringify(mockSchema.providers));
    this.rubrics = JSON.parse(JSON.stringify(mockSchema.rubrics));
    this.scenarios = JSON.parse(JSON.stringify(mockSchema.scenarios));
    this.simulationAttempts = JSON.parse(
      JSON.stringify(mockSchema.simulationAttempts),
    );
    this.simulationChatCrowdsourcedFeedbacks = JSON.parse(
      JSON.stringify(mockSchema.simulationChatCrowdsourcedFeedbacks),
    );
    this.simulationChatFeedbacks = JSON.parse(
      JSON.stringify(mockSchema.simulationChatFeedbacks),
    );
    this.simulationChatGrades = JSON.parse(
      JSON.stringify(mockSchema.simulationChatGrades),
    );
    this.simulationChats = JSON.parse(
      JSON.stringify(mockSchema.simulationChats),
    );
    this.simulationCrowdsourcedMessages = JSON.parse(
      JSON.stringify(mockSchema.simulationCrowdsourcedMessages),
    );
    this.simulationMessages = JSON.parse(
      JSON.stringify(mockSchema.simulationMessages),
    );
    this.simulations = JSON.parse(JSON.stringify(mockSchema.simulations));
    this.standardGroups = JSON.parse(JSON.stringify(mockSchema.standardGroups));
    this.standards = JSON.parse(JSON.stringify(mockSchema.standards));
  }

  // AGENTS Queries
  getAllAgents() {
    return this.agents;
  }
  getAgent(id: string) {
    return this.agents.find((item) => item.id === id) || null;
  }
  getAgentsByModel(modelId: string) {
    return this.agents.filter((item) => item.modelId === modelId);
  }

  // AGENTS Mutations
  createAgent(data: Partial<Agent>) {
    const newItem = createMockAgent({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.agents.push(newItem);
    return newItem;
  }
  updateAgent(id: string, data: Partial<Agent>) {
    const itemIndex = this.agents.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    this.agents[itemIndex] = { ...this.agents[itemIndex], ...data } as Agent;
    return this.agents[itemIndex];
  }
  deleteAgent(id: string) {
    const itemIndex = this.agents.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.agents.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // APPFEEDBACK Queries
  getAllAppFeedback() {
    return this.appFeedback;
  }
  getAppFeedback(id: number) {
    return this.appFeedback.find((item) => item.id === id) || null;
  }
  getAppFeedbackByProfile(profileId: string) {
    return this.appFeedback.filter((item) => item.profileId === profileId);
  }

  // APPFEEDBACK Mutations
  createAppFeedback(data: Partial<AppFeedback>) {
    const newItem = createMockAppFeedback({
      ...data,
      id: data.id ?? faker.number.int(),
    });
    this.appFeedback.push(newItem);
    return newItem;
  }
  updateAppFeedback(id: number, data: Partial<AppFeedback>) {
    const itemIndex = this.appFeedback.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    this.appFeedback[itemIndex] = {
      ...this.appFeedback[itemIndex],
      ...data,
    } as AppFeedback;
    return this.appFeedback[itemIndex];
  }
  deleteAppFeedback(id: number) {
    const itemIndex = this.appFeedback.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.appFeedback.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // APPLOGS Queries
  getAllAppLogs() {
    return this.appLogs;
  }
  getAppLog(id: number) {
    return this.appLogs.find((item) => item.id === id) || null;
  }

  // APPLOGS Mutations
  createAppLog(data: Partial<AppLog>) {
    const newItem = createMockAppLog({
      ...data,
      id: data.id ?? faker.number.int(),
    });
    this.appLogs.push(newItem);
    return newItem;
  }
  updateAppLog(id: number, data: Partial<AppLog>) {
    const itemIndex = this.appLogs.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    this.appLogs[itemIndex] = { ...this.appLogs[itemIndex], ...data } as AppLog;
    return this.appLogs[itemIndex];
  }
  deleteAppLog(id: number) {
    const itemIndex = this.appLogs.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.appLogs.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // ASSISTANTCHATS Queries
  getAllAssistantChats() {
    return this.assistantChats;
  }
  getAssistantChat(id: string) {
    return this.assistantChats.find((item) => item.id === id) || null;
  }
  getAssistantChatsByProfile(profileId: string) {
    return this.assistantChats.filter((item) => item.profileId === profileId);
  }

  // ASSISTANTCHATS Mutations
  createAssistantChat(data: Partial<AssistantChat>) {
    const newItem = createMockAssistantChat({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.assistantChats.push(newItem);
    return newItem;
  }
  updateAssistantChat(id: string, data: Partial<AssistantChat>) {
    const itemIndex = this.assistantChats.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    this.assistantChats[itemIndex] = {
      ...this.assistantChats[itemIndex],
      ...data,
    } as AssistantChat;
    return this.assistantChats[itemIndex];
  }
  deleteAssistantChat(id: string) {
    const itemIndex = this.assistantChats.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.assistantChats.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // ASSISTANTMESSAGES Queries
  getAllAssistantMessages() {
    return this.assistantMessages;
  }
  getAssistantMessage(id: string) {
    return this.assistantMessages.find((item) => item.id === id) || null;
  }
  getAssistantMessagesByAssistantChat(assistantChatId: string) {
    return this.assistantMessages.filter(
      (item) => item.chatId === assistantChatId,
    );
  }

  // ASSISTANTMESSAGES Mutations
  createAssistantMessage(data: Partial<AssistantMessage>) {
    const newItem = createMockAssistantMessage({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.assistantMessages.push(newItem);
    return newItem;
  }
  updateAssistantMessage(id: string, data: Partial<AssistantMessage>) {
    const itemIndex = this.assistantMessages.findIndex(
      (item) => item.id === id,
    );
    if (itemIndex === -1) return null;
    this.assistantMessages[itemIndex] = {
      ...this.assistantMessages[itemIndex],
      ...data,
    } as AssistantMessage;
    return this.assistantMessages[itemIndex];
  }
  deleteAssistantMessage(id: string) {
    const itemIndex = this.assistantMessages.findIndex(
      (item) => item.id === id,
    );
    if (itemIndex === -1) return null;
    const deletedItem = this.assistantMessages.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // ASSISTANTTOOLCALLS Queries
  getAllAssistantToolCalls() {
    return this.assistantToolCalls;
  }
  getAssistantToolCall(id: string) {
    return this.assistantToolCalls.find((item) => item.id === id) || null;
  }
  getAssistantToolCallsByAssistantChat(assistantChatId: string) {
    return this.assistantToolCalls.filter(
      (item) => item.chatId === assistantChatId,
    );
  }

  // ASSISTANTTOOLCALLS Mutations
  createAssistantToolCall(data: Partial<AssistantToolCall>) {
    const newItem = createMockAssistantToolCall({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.assistantToolCalls.push(newItem);
    return newItem;
  }
  updateAssistantToolCall(id: string, data: Partial<AssistantToolCall>) {
    const itemIndex = this.assistantToolCalls.findIndex(
      (item) => item.id === id,
    );
    if (itemIndex === -1) return null;
    this.assistantToolCalls[itemIndex] = {
      ...this.assistantToolCalls[itemIndex],
      ...data,
    } as AssistantToolCall;
    return this.assistantToolCalls[itemIndex];
  }
  deleteAssistantToolCall(id: string) {
    const itemIndex = this.assistantToolCalls.findIndex(
      (item) => item.id === id,
    );
    if (itemIndex === -1) return null;
    const deletedItem = this.assistantToolCalls.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // COHORTS Queries
  getAllCohorts() {
    return this.cohorts;
  }
  getCohort(id: string) {
    return this.cohorts.find((item) => item.id === id) || null;
  }

  // COHORTS Mutations
  createCohort(data: Partial<Cohort>) {
    const newItem = createMockCohort({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.cohorts.push(newItem);
    return newItem;
  }
  updateCohort(id: string, data: Partial<Cohort>) {
    const itemIndex = this.cohorts.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    this.cohorts[itemIndex] = { ...this.cohorts[itemIndex], ...data } as Cohort;
    return this.cohorts[itemIndex];
  }
  deleteCohort(id: string) {
    const itemIndex = this.cohorts.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.cohorts.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // DEBUGINFO Queries
  getAllDebugInfo() {
    return this.debugInfo;
  }
  getDebugInfo(id: string) {
    return this.debugInfo.find((item) => item.id === id) || null;
  }
  getDebugInfoByModelRun(modelRunId: string) {
    return this.debugInfo.filter((item) => item.modelRunId === modelRunId);
  }

  // DEBUGINFO Mutations
  createDebugInfo(data: Partial<DebugInfo>) {
    const newItem = createMockDebugInfo({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.debugInfo.push(newItem);
    return newItem;
  }
  updateDebugInfo(id: string, data: Partial<DebugInfo>) {
    const itemIndex = this.debugInfo.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    this.debugInfo[itemIndex] = {
      ...this.debugInfo[itemIndex],
      ...data,
    } as DebugInfo;
    return this.debugInfo[itemIndex];
  }
  deleteDebugInfo(id: string) {
    const itemIndex = this.debugInfo.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.debugInfo.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // DOCUMENTS Queries
  getAllDocuments() {
    return this.documents;
  }
  getDocument(id: string) {
    return this.documents.find((item) => item.id === id) || null;
  }

  // DOCUMENTS Mutations
  createDocument(data: Partial<Document>) {
    const newItem = createMockDocument({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.documents.push(newItem);
    return newItem;
  }
  updateDocument(id: string, data: Partial<Document>) {
    const itemIndex = this.documents.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    this.documents[itemIndex] = {
      ...this.documents[itemIndex],
      ...data,
    } as Document;
    return this.documents[itemIndex];
  }
  deleteDocument(id: string) {
    const itemIndex = this.documents.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.documents.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // MODELRUNS Queries
  getAllModelRuns() {
    return this.modelRuns;
  }
  getModelRun(id: string) {
    return this.modelRuns.find((item) => item.id === id) || null;
  }
  getModelRunsByModel(modelId: string) {
    return this.modelRuns.filter((item) => item.modelId === modelId);
  }
  getModelRunsByPersona(personaId: string) {
    return this.modelRuns.filter((item) => item.personaId === personaId);
  }
  getModelRunsByAgent(agentId: string) {
    return this.modelRuns.filter((item) => item.agentId === agentId);
  }
  getModelRunsByProfile(profileId: string) {
    return this.modelRuns.filter((item) => item.profileId === profileId);
  }

  // MODELRUNS Mutations
  createModelRun(data: Partial<ModelRun>) {
    const newItem = createMockModelRun({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.modelRuns.push(newItem);
    return newItem;
  }
  updateModelRun(id: string, data: Partial<ModelRun>) {
    const itemIndex = this.modelRuns.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    this.modelRuns[itemIndex] = {
      ...this.modelRuns[itemIndex],
      ...data,
    } as ModelRun;
    return this.modelRuns[itemIndex];
  }
  deleteModelRun(id: string) {
    const itemIndex = this.modelRuns.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.modelRuns.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // MODELS Queries
  getAllModels() {
    return this.models;
  }
  getModel(id: string) {
    return this.models.find((item) => item.id === id) || null;
  }

  // MODELS Mutations
  createModel(data: Partial<Model>) {
    const newItem = createMockModel({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.models.push(newItem);
    return newItem;
  }
  updateModel(id: string, data: Partial<Model>) {
    const itemIndex = this.models.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    this.models[itemIndex] = { ...this.models[itemIndex], ...data } as Model;
    return this.models[itemIndex];
  }
  deleteModel(id: string) {
    const itemIndex = this.models.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.models.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // PARAMETERITEMS Queries
  getAllParameterItems() {
    return this.parameterItems;
  }
  getParameterItem(id: string) {
    return this.parameterItems.find((item) => item.id === id) || null;
  }
  getParameterItemsByParameter(parameterId: string) {
    return this.parameterItems.filter(
      (item) => item.parameterId === parameterId,
    );
  }

  // PARAMETERITEMS Mutations
  createParameterItem(data: Partial<ParameterItem>) {
    const newItem = createMockParameterItem({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.parameterItems.push(newItem);
    return newItem;
  }
  updateParameterItem(id: string, data: Partial<ParameterItem>) {
    const itemIndex = this.parameterItems.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    this.parameterItems[itemIndex] = {
      ...this.parameterItems[itemIndex],
      ...data,
    } as ParameterItem;
    return this.parameterItems[itemIndex];
  }
  deleteParameterItem(id: string) {
    const itemIndex = this.parameterItems.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.parameterItems.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // PARAMETERS Queries
  getAllParameters() {
    return this.parameters;
  }
  getParameter(id: string) {
    return this.parameters.find((item) => item.id === id) || null;
  }

  // PARAMETERS Mutations
  createParameter(data: Partial<Parameter>) {
    const newItem = createMockParameter({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.parameters.push(newItem);
    return newItem;
  }
  updateParameter(id: string, data: Partial<Parameter>) {
    const itemIndex = this.parameters.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    this.parameters[itemIndex] = {
      ...this.parameters[itemIndex],
      ...data,
    } as Parameter;
    return this.parameters[itemIndex];
  }
  deleteParameter(id: string) {
    const itemIndex = this.parameters.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.parameters.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // PERSONAS Queries
  getAllPersonas() {
    return this.personas;
  }
  getPersona(id: string) {
    return this.personas.find((item) => item.id === id) || null;
  }
  getPersonasByModel(modelId: string) {
    return this.personas.filter((item) => item.modelId === modelId);
  }

  // PERSONAS Mutations
  createPersona(data: Partial<Persona>) {
    const newItem = createMockPersona({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.personas.push(newItem);
    return newItem;
  }
  updatePersona(id: string, data: Partial<Persona>) {
    const itemIndex = this.personas.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    this.personas[itemIndex] = {
      ...this.personas[itemIndex],
      ...data,
    } as Persona;
    return this.personas[itemIndex];
  }
  deletePersona(id: string) {
    const itemIndex = this.personas.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.personas.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // PROFILES Queries
  getAllProfiles() {
    return this.profiles;
  }
  getProfile(id: string) {
    return this.profiles.find((item) => item.id === id) || null;
  }

  // PROFILES Mutations
  createProfile(data: Partial<Profile>) {
    const newItem = createMockProfile({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.profiles.push(newItem);
    return newItem;
  }
  updateProfile(id: string, data: Partial<Profile>) {
    const itemIndex = this.profiles.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    this.profiles[itemIndex] = {
      ...this.profiles[itemIndex],
      ...data,
    } as Profile;
    return this.profiles[itemIndex];
  }
  deleteProfile(id: string) {
    const itemIndex = this.profiles.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.profiles.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // PROVIDERS Queries
  getAllProviders() {
    return this.providers;
  }
  getProvider(id: string) {
    return this.providers.find((item) => item.id === id) || null;
  }

  // PROVIDERS Mutations
  createProvider(data: Partial<Provider>) {
    const newItem = createMockProvider({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.providers.push(newItem);
    return newItem;
  }
  updateProvider(id: string, data: Partial<Provider>) {
    const itemIndex = this.providers.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    this.providers[itemIndex] = {
      ...this.providers[itemIndex],
      ...data,
    } as Provider;
    return this.providers[itemIndex];
  }
  deleteProvider(id: string) {
    const itemIndex = this.providers.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.providers.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // RUBRICS Queries
  getAllRubrics() {
    return this.rubrics;
  }
  getRubric(id: string) {
    return this.rubrics.find((item) => item.id === id) || null;
  }

  // RUBRICS Mutations
  createRubric(data: Partial<Rubric>) {
    const newItem = createMockRubric({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.rubrics.push(newItem);
    return newItem;
  }
  updateRubric(id: string, data: Partial<Rubric>) {
    const itemIndex = this.rubrics.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    this.rubrics[itemIndex] = { ...this.rubrics[itemIndex], ...data } as Rubric;
    return this.rubrics[itemIndex];
  }
  deleteRubric(id: string) {
    const itemIndex = this.rubrics.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.rubrics.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // SCENARIOS Queries
  getAllScenarios() {
    return this.scenarios;
  }
  getScenario(id: string) {
    return this.scenarios.find((item) => item.id === id) || null;
  }
  getScenariosByPersona(personaId: string) {
    return this.scenarios.filter((item) => item.personaId === personaId);
  }

  // SCENARIOS Mutations
  createScenario(data: Partial<Scenario>) {
    const newItem = createMockScenario({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.scenarios.push(newItem);
    return newItem;
  }
  updateScenario(id: string, data: Partial<Scenario>) {
    const itemIndex = this.scenarios.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    this.scenarios[itemIndex] = {
      ...this.scenarios[itemIndex],
      ...data,
    } as Scenario;
    return this.scenarios[itemIndex];
  }
  deleteScenario(id: string) {
    const itemIndex = this.scenarios.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.scenarios.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // SIMULATIONATTEMPTS Queries
  getAllSimulationAttempts() {
    return this.simulationAttempts;
  }
  getSimulationAttempt(id: string) {
    return this.simulationAttempts.find((item) => item.id === id) || null;
  }
  getSimulationAttemptsByProfile(profileId: string) {
    return this.simulationAttempts.filter(
      (item) => item.profileId === profileId,
    );
  }
  getSimulationAttemptsBySimulation(simulationId: string) {
    return this.simulationAttempts.filter(
      (item) => item.simulationId === simulationId,
    );
  }

  // SIMULATIONATTEMPTS Mutations
  createSimulationAttempt(data: Partial<SimulationAttempt>) {
    const newItem = createMockSimulationAttempt({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.simulationAttempts.push(newItem);
    return newItem;
  }
  updateSimulationAttempt(id: string, data: Partial<SimulationAttempt>) {
    const itemIndex = this.simulationAttempts.findIndex(
      (item) => item.id === id,
    );
    if (itemIndex === -1) return null;
    this.simulationAttempts[itemIndex] = {
      ...this.simulationAttempts[itemIndex],
      ...data,
    } as SimulationAttempt;
    return this.simulationAttempts[itemIndex];
  }
  deleteSimulationAttempt(id: string) {
    const itemIndex = this.simulationAttempts.findIndex(
      (item) => item.id === id,
    );
    if (itemIndex === -1) return null;
    const deletedItem = this.simulationAttempts.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // SIMULATIONCHATCROWDSOURCEDFEEDBACKS Queries
  getAllSimulationChatCrowdsourcedFeedbacks() {
    return this.simulationChatCrowdsourcedFeedbacks;
  }
  getSimulationChatCrowdsourcedFeedback(id: string) {
    return (
      this.simulationChatCrowdsourcedFeedbacks.find((item) => item.id === id) ||
      null
    );
  }
  getSimulationChatCrowdsourcedFeedbacksByProfile(profileId: string) {
    return this.simulationChatCrowdsourcedFeedbacks.filter(
      (item) => item.profileId === profileId,
    );
  }
  getSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedback(
    simulationChatFeedbackId: string,
  ) {
    return this.simulationChatCrowdsourcedFeedbacks.filter(
      (item) => item.simulationChatFeedbackId === simulationChatFeedbackId,
    );
  }

  // SIMULATIONCHATCROWDSOURCEDFEEDBACKS Mutations
  createSimulationChatCrowdsourcedFeedback(
    data: Partial<SimulationChatCrowdsourcedFeedback>,
  ) {
    const newItem = createMockSimulationChatCrowdsourcedFeedback({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.simulationChatCrowdsourcedFeedbacks.push(newItem);
    return newItem;
  }
  updateSimulationChatCrowdsourcedFeedback(
    id: string,
    data: Partial<SimulationChatCrowdsourcedFeedback>,
  ) {
    const itemIndex = this.simulationChatCrowdsourcedFeedbacks.findIndex(
      (item) => item.id === id,
    );
    if (itemIndex === -1) return null;
    this.simulationChatCrowdsourcedFeedbacks[itemIndex] = {
      ...this.simulationChatCrowdsourcedFeedbacks[itemIndex],
      ...data,
    } as SimulationChatCrowdsourcedFeedback;
    return this.simulationChatCrowdsourcedFeedbacks[itemIndex];
  }
  deleteSimulationChatCrowdsourcedFeedback(id: string) {
    const itemIndex = this.simulationChatCrowdsourcedFeedbacks.findIndex(
      (item) => item.id === id,
    );
    if (itemIndex === -1) return null;
    const deletedItem = this.simulationChatCrowdsourcedFeedbacks.splice(
      itemIndex,
      1,
    );
    return deletedItem[0];
  }

  // SIMULATIONCHATFEEDBACKS Queries
  getAllSimulationChatFeedbacks() {
    return this.simulationChatFeedbacks;
  }
  getSimulationChatFeedback(id: string) {
    return this.simulationChatFeedbacks.find((item) => item.id === id) || null;
  }
  getSimulationChatFeedbacksByStandard(standardId: string) {
    return this.simulationChatFeedbacks.filter(
      (item) => item.standardId === standardId,
    );
  }
  getSimulationChatFeedbacksBySimulationChatGrade(
    simulationChatGradeId: string,
  ) {
    return this.simulationChatFeedbacks.filter(
      (item) => item.simulationChatGradeId === simulationChatGradeId,
    );
  }

  // SIMULATIONCHATFEEDBACKS Mutations
  createSimulationChatFeedback(data: Partial<SimulationChatFeedback>) {
    const newItem = createMockSimulationChatFeedback({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.simulationChatFeedbacks.push(newItem);
    return newItem;
  }
  updateSimulationChatFeedback(
    id: string,
    data: Partial<SimulationChatFeedback>,
  ) {
    const itemIndex = this.simulationChatFeedbacks.findIndex(
      (item) => item.id === id,
    );
    if (itemIndex === -1) return null;
    this.simulationChatFeedbacks[itemIndex] = {
      ...this.simulationChatFeedbacks[itemIndex],
      ...data,
    } as SimulationChatFeedback;
    return this.simulationChatFeedbacks[itemIndex];
  }
  deleteSimulationChatFeedback(id: string) {
    const itemIndex = this.simulationChatFeedbacks.findIndex(
      (item) => item.id === id,
    );
    if (itemIndex === -1) return null;
    const deletedItem = this.simulationChatFeedbacks.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // SIMULATIONCHATGRADES Queries
  getAllSimulationChatGrades() {
    return this.simulationChatGrades;
  }
  getSimulationChatGrade(id: string) {
    return this.simulationChatGrades.find((item) => item.id === id) || null;
  }
  getSimulationChatGradesByRubric(rubricId: string) {
    return this.simulationChatGrades.filter(
      (item) => item.rubricId === rubricId,
    );
  }
  getSimulationChatGradesBySimulationChat(simulationChatId: string) {
    return this.simulationChatGrades.filter(
      (item) => item.simulationChatId === simulationChatId,
    );
  }

  // SIMULATIONCHATGRADES Mutations
  createSimulationChatGrade(data: Partial<SimulationChatGrade>) {
    const newItem = createMockSimulationChatGrade({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.simulationChatGrades.push(newItem);
    return newItem;
  }
  updateSimulationChatGrade(id: string, data: Partial<SimulationChatGrade>) {
    const itemIndex = this.simulationChatGrades.findIndex(
      (item) => item.id === id,
    );
    if (itemIndex === -1) return null;
    this.simulationChatGrades[itemIndex] = {
      ...this.simulationChatGrades[itemIndex],
      ...data,
    } as SimulationChatGrade;
    return this.simulationChatGrades[itemIndex];
  }
  deleteSimulationChatGrade(id: string) {
    const itemIndex = this.simulationChatGrades.findIndex(
      (item) => item.id === id,
    );
    if (itemIndex === -1) return null;
    const deletedItem = this.simulationChatGrades.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // SIMULATIONCHATS Queries
  getAllSimulationChats() {
    return this.simulationChats;
  }
  getSimulationChat(id: string) {
    return this.simulationChats.find((item) => item.id === id) || null;
  }
  getSimulationChatsByScenario(scenarioId: string) {
    return this.simulationChats.filter(
      (item) => item.scenarioId === scenarioId,
    );
  }
  getSimulationChatsBySimulationAttempt(simulationAttemptId: string) {
    return this.simulationChats.filter(
      (item) => item.attemptId === simulationAttemptId,
    );
  }

  // SIMULATIONCHATS Mutations
  createSimulationChat(data: Partial<SimulationChat>) {
    const newItem = createMockSimulationChat({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.simulationChats.push(newItem);
    return newItem;
  }
  updateSimulationChat(id: string, data: Partial<SimulationChat>) {
    const itemIndex = this.simulationChats.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    this.simulationChats[itemIndex] = {
      ...this.simulationChats[itemIndex],
      ...data,
    } as SimulationChat;
    return this.simulationChats[itemIndex];
  }
  deleteSimulationChat(id: string) {
    const itemIndex = this.simulationChats.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.simulationChats.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // SIMULATIONCROWDSOURCEDMESSAGES Queries
  getAllSimulationCrowdsourcedMessages() {
    return this.simulationCrowdsourcedMessages;
  }
  getSimulationCrowdsourcedMessage(id: string) {
    return (
      this.simulationCrowdsourcedMessages.find((item) => item.id === id) || null
    );
  }
  getSimulationCrowdsourcedMessagesBySimulationMessage(
    simulationMessageId: string,
  ) {
    return this.simulationCrowdsourcedMessages.filter(
      (item) => item.simulationMessageId === simulationMessageId,
    );
  }
  getSimulationCrowdsourcedMessagesByProfile(profileId: string) {
    return this.simulationCrowdsourcedMessages.filter(
      (item) => item.profileId === profileId,
    );
  }

  // SIMULATIONCROWDSOURCEDMESSAGES Mutations
  createSimulationCrowdsourcedMessage(
    data: Partial<SimulationCrowdsourcedMessage>,
  ) {
    const newItem = createMockSimulationCrowdsourcedMessage({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.simulationCrowdsourcedMessages.push(newItem);
    return newItem;
  }
  updateSimulationCrowdsourcedMessage(
    id: string,
    data: Partial<SimulationCrowdsourcedMessage>,
  ) {
    const itemIndex = this.simulationCrowdsourcedMessages.findIndex(
      (item) => item.id === id,
    );
    if (itemIndex === -1) return null;
    this.simulationCrowdsourcedMessages[itemIndex] = {
      ...this.simulationCrowdsourcedMessages[itemIndex],
      ...data,
    } as SimulationCrowdsourcedMessage;
    return this.simulationCrowdsourcedMessages[itemIndex];
  }
  deleteSimulationCrowdsourcedMessage(id: string) {
    const itemIndex = this.simulationCrowdsourcedMessages.findIndex(
      (item) => item.id === id,
    );
    if (itemIndex === -1) return null;
    const deletedItem = this.simulationCrowdsourcedMessages.splice(
      itemIndex,
      1,
    );
    return deletedItem[0];
  }

  // SIMULATIONMESSAGES Queries
  getAllSimulationMessages() {
    return this.simulationMessages;
  }
  getSimulationMessage(id: string) {
    return this.simulationMessages.find((item) => item.id === id) || null;
  }
  getSimulationMessagesBySimulationChat(simulationChatId: string) {
    return this.simulationMessages.filter(
      (item) => item.chatId === simulationChatId,
    );
  }

  // SIMULATIONMESSAGES Mutations
  createSimulationMessage(data: Partial<SimulationMessage>) {
    const newItem = createMockSimulationMessage({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.simulationMessages.push(newItem);
    return newItem;
  }
  updateSimulationMessage(id: string, data: Partial<SimulationMessage>) {
    const itemIndex = this.simulationMessages.findIndex(
      (item) => item.id === id,
    );
    if (itemIndex === -1) return null;
    this.simulationMessages[itemIndex] = {
      ...this.simulationMessages[itemIndex],
      ...data,
    } as SimulationMessage;
    return this.simulationMessages[itemIndex];
  }
  deleteSimulationMessage(id: string) {
    const itemIndex = this.simulationMessages.findIndex(
      (item) => item.id === id,
    );
    if (itemIndex === -1) return null;
    const deletedItem = this.simulationMessages.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // SIMULATIONS Queries
  getAllSimulations() {
    return this.simulations;
  }
  getSimulation(id: string) {
    return this.simulations.find((item) => item.id === id) || null;
  }
  getSimulationsByRubric(rubricId: string) {
    return this.simulations.filter((item) => item.rubricId === rubricId);
  }

  // SIMULATIONS Mutations
  createSimulation(data: Partial<Simulation>) {
    const newItem = createMockSimulation({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.simulations.push(newItem);
    return newItem;
  }
  updateSimulation(id: string, data: Partial<Simulation>) {
    const itemIndex = this.simulations.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    this.simulations[itemIndex] = {
      ...this.simulations[itemIndex],
      ...data,
    } as Simulation;
    return this.simulations[itemIndex];
  }
  deleteSimulation(id: string) {
    const itemIndex = this.simulations.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.simulations.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // STANDARDGROUPS Queries
  getAllStandardGroups() {
    return this.standardGroups;
  }
  getStandardGroup(id: string) {
    return this.standardGroups.find((item) => item.id === id) || null;
  }
  getStandardGroupsByRubric(rubricId: string) {
    return this.standardGroups.filter((item) => item.rubricId === rubricId);
  }

  // STANDARDGROUPS Mutations
  createStandardGroup(data: Partial<StandardGroup>) {
    const newItem = createMockStandardGroup({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.standardGroups.push(newItem);
    return newItem;
  }
  updateStandardGroup(id: string, data: Partial<StandardGroup>) {
    const itemIndex = this.standardGroups.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    this.standardGroups[itemIndex] = {
      ...this.standardGroups[itemIndex],
      ...data,
    } as StandardGroup;
    return this.standardGroups[itemIndex];
  }
  deleteStandardGroup(id: string) {
    const itemIndex = this.standardGroups.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.standardGroups.splice(itemIndex, 1);
    return deletedItem[0];
  }

  // STANDARDS Queries
  getAllStandards() {
    return this.standards;
  }
  getStandard(id: string) {
    return this.standards.find((item) => item.id === id) || null;
  }
  getStandardsByStandardGroup(standardGroupId: string) {
    return this.standards.filter(
      (item) => item.standardGroupId === standardGroupId,
    );
  }

  // STANDARDS Mutations
  createStandard(data: Partial<Standard>) {
    const newItem = createMockStandard({
      ...data,
      id: data.id ?? faker.string.uuid(),
    });
    this.standards.push(newItem);
    return newItem;
  }
  updateStandard(id: string, data: Partial<Standard>) {
    const itemIndex = this.standards.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    this.standards[itemIndex] = {
      ...this.standards[itemIndex],
      ...data,
    } as Standard;
    return this.standards[itemIndex];
  }
  deleteStandard(id: string) {
    const itemIndex = this.standards.findIndex((item) => item.id === id);
    if (itemIndex === -1) return null;
    const deletedItem = this.standards.splice(itemIndex, 1);
    return deletedItem[0];
  }
}
