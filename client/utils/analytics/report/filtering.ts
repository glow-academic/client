import { ProfileRole } from "@/types";

// Minimal shapes for the datasets we use here. These mirror fields referenced across the analytics code.
export interface AttemptEntity {
  id: string;
  profileId: string | null;
  simulationId: string;
  createdAt: string | Date;
}

export interface ChatEntity {
  id: string;
  attemptId: string;
  scenarioId: string;
  completed?: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  completedAt?: string | Date | null;
}

export interface GradeEntity {
  id: string;
  simulationChatId: string; // links to ChatEntity.id
  score: number; // raw score (points)
  timeTaken: number; // seconds
  passed: boolean;
  createdAt: string | Date;
}

export interface MessageEntity {
  id: string;
  chatId: string; // links to ChatEntity.id
  createdAt: string | Date;
  // Optional fields used for response-time calculations
  type?: string; // e.g., 'query' | 'response'
}

export interface SimulationEntity {
  id: string;
  title: string;
  rubricId: string;
  practiceSimulation?: boolean;
}

export interface ScenarioEntity {
  id: string;
  name: string;
  personaId: string | null;
  practiceScenario?: boolean;
}

export interface RubricEntity {
  id: string;
  points: number; // total possible points
}

export interface CohortEntity {
  id: string;
  title: string;
  active: boolean;
  profileIds: string[];
  simulationIds: string[];
  createdAt: string | Date;
}

export interface AnalyticsFilters {
  startDate: Date;
  endDate: Date;
  effectiveCohortIds: string[];
  selectedRoles: ProfileRole[];
  showPractice: boolean;
  showNormal: boolean;
  cohorts: CohortEntity[];
}

export interface ToolbarFilters {
  personaIds: string[];
  scenarioIds: string[];
  simulationIds: string[];
}

export interface Datasets {
  attempts: AttemptEntity[];
  chats: ChatEntity[];
  grades: GradeEntity[];
  messages: MessageEntity[];
  simulations: SimulationEntity[];
  scenarios: ScenarioEntity[];
  rubrics: RubricEntity[];
}

export interface FilteredViewForTa {
  attempts: AttemptEntity[];
  chats: ChatEntity[];
  grades: GradeEntity[];
  messagesByChat: Map<string, MessageEntity[]>;
  simulationById: Map<string, SimulationEntity>;
  scenarioById: Map<string, ScenarioEntity>;
  rubricPointsBySimulationId: Map<string, number>;
}

// Apply analytics-level filters and toolbar filters; then narrow by TA id
export function buildFilteredViewForTa(
  taProfileId: string,
  datasets: Datasets,
  analytics: AnalyticsFilters,
  toolbar: ToolbarFilters
): FilteredViewForTa {
  const { attempts, chats, grades, messages, simulations, scenarios, rubrics } =
    datasets;

  const startMs = analytics.startDate.getTime();
  const endMs = analytics.endDate.getTime();

  // Restrict to simulations by selected cohorts (if any)
  let allowedSimulationIds: Set<string> | null = null;
  if (analytics.effectiveCohortIds.length > 0) {
    const selectedCohorts = analytics.cohorts.filter((c) =>
      analytics.effectiveCohortIds.includes(c.id)
    );
    allowedSimulationIds = new Set<string>();
    selectedCohorts.forEach((c) =>
      c.simulationIds.forEach((id) => allowedSimulationIds!.add(id))
    );
  }

  // Practice/Normal flags
  const practicePredicate = (simulation: SimulationEntity) => {
    const isPractice = !!simulation.practiceSimulation;
    if (analytics.showPractice && analytics.showNormal) return true;
    if (analytics.showPractice && !analytics.showNormal) return isPractice;
    if (!analytics.showPractice && analytics.showNormal) return !isPractice;
    return false; // both false → nothing
  };

  // Toolbar filters: persona/scenario/simulation
  const personaFilterSet = new Set(toolbar.personaIds || []);
  const scenarioFilterSet = new Set(toolbar.scenarioIds || []);
  const simulationFilterSet = new Set(toolbar.simulationIds || []);
  const hasPersonaFilter = personaFilterSet.size > 0;
  const hasScenarioFilter = scenarioFilterSet.size > 0;
  const hasSimulationFilter = simulationFilterSet.size > 0;

  // Index maps
  const simulationById = new Map(simulations.map((s) => [s.id, s] as const));
  const scenarioById = new Map(scenarios.map((s) => [s.id, s] as const));
  const rubricPointsById = new Map(
    rubrics.map((r) => [r.id, r.points] as const)
  );

  // First, restrict attempts by TA id, date, cohorts, and practice flags
  const attemptsByTa = attempts.filter((a) => {
    if (a.profileId !== taProfileId) return false;
    const createdMs = new Date(a.createdAt).getTime();
    if (createdMs < startMs || createdMs > endMs) return false;
    const simulation = simulationById.get(a.simulationId);
    if (!simulation) return false;
    if (allowedSimulationIds && !allowedSimulationIds.has(simulation.id))
      return false;
    if (!practicePredicate(simulation)) return false;
    // Toolbar simulation filter
    if (hasSimulationFilter && !simulationFilterSet.has(simulation.id))
      return false;
    return true;
  });

  const attemptIdSet = new Set(attemptsByTa.map((a) => a.id));

  // Restrict chats by attempts, date, toolbar persona/scenario filters
  const chatsByTa = chats.filter((c) => {
    if (!attemptIdSet.has(c.attemptId)) return false;
    const createdMs = new Date(c.createdAt).getTime();
    if (createdMs < startMs || createdMs > endMs) return false;
    if (hasScenarioFilter && !scenarioFilterSet.has(c.scenarioId)) return false;
    if (hasPersonaFilter) {
      const scenario = scenarioById.get(c.scenarioId);
      const personaId = scenario?.personaId ?? null;
      if (!personaId || !personaFilterSet.has(personaId)) return false;
    }
    return true;
  });
  const chatIdSet = new Set(chatsByTa.map((c) => c.id));

  // Restrict grades by chats and date
  const gradesByTa = grades.filter((g) => {
    if (!chatIdSet.has(g.simulationChatId)) return false;
    const createdMs = new Date(g.createdAt).getTime();
    return createdMs >= startMs && createdMs <= endMs;
  });

  // Messages map by chat
  const messagesByChat = new Map<string, MessageEntity[]>();
  for (const m of messages) {
    if (!chatIdSet.has(m.chatId)) continue;
    const createdMs = new Date(m.createdAt).getTime();
    if (createdMs < startMs || createdMs > endMs) continue;
    const arr = messagesByChat.get(m.chatId) ?? [];
    arr.push(m);
    messagesByChat.set(m.chatId, arr);
  }

  // Rubric points by simulation id
  const rubricPointsBySimulationId = new Map<string, number>();
  for (const sim of simulations) {
    const points = rubricPointsById.get(sim.rubricId) ?? 100;
    rubricPointsBySimulationId.set(sim.id, points);
  }

  return {
    attempts: attemptsByTa,
    chats: chatsByTa,
    grades: gradesByTa,
    messagesByChat,
    simulationById,
    scenarioById,
    rubricPointsBySimulationId,
  };
}
