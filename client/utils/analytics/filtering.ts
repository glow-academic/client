import { SimulationFilter } from "@/contexts/analytics-context";
import type {
  Agent,
  Cohort,
  Parameter,
  ParameterItem,
  Persona,
  Profile,
  ProfileRole,
  Rubric,
  Scenario,
  Simulation,
  SimulationAttempt,
  SimulationChat,
  SimulationChatFeedback,
  SimulationChatGrade,
  SimulationMessage,
  Standard,
  StandardGroup,
} from "@/types";
import { isAfter, isBefore } from "date-fns";

export interface FilteredData {
  // Core filtered data
  attempts: SimulationAttempt[];
  chats: SimulationChat[];
  grades: SimulationChatGrade[];
  feedbacks: SimulationChatFeedback[];
  messages: SimulationMessage[];

  // Derived data for convenience
  simulations: Simulation[];
  scenarios: Scenario[];
  profiles: Profile[];
  cohorts: Cohort[];
  rubrics: Rubric[];
  standardGroups: StandardGroup[];
  standards: Standard[];
  // Scenario taxonomy and entities used for analytics
  parameters: Parameter[];
  parameterItems: ParameterItem[];
  personas: Persona[];
  // Optional for future consumers
  agents?: Agent[];
}

export interface FilteringOptions {
  // Date range (required)
  startDate: Date;
  endDate: Date;

  // Cohort filtering
  cohortIds?: string[];

  // Role filtering
  roles?: ProfileRole[];

  // Practice/General/Archived filtering
  simulationFilters?: SimulationFilter[];

  // Profile-specific filtering
  profileId?: string | undefined;

  // Raw data
  allAttempts: SimulationAttempt[];
  allChats: SimulationChat[];
  allGrades: SimulationChatGrade[];
  allFeedbacks: SimulationChatFeedback[];
  allSimulations: Simulation[];
  allScenarios: Scenario[];
  allProfiles: Profile[];
  allCohorts: Cohort[];
  // Optional universal datasets (if available)
  allMessages?: SimulationMessage[];
  allRubrics?: Rubric[];
  allStandardGroups?: StandardGroup[];
  allStandards?: Standard[];
  allParameters?: Parameter[];
  allParameterItems?: ParameterItem[];
  allPersonas?: Persona[];
  allAgents?: Agent[];
}

/**
 * Centralized filtering function that implements GLOW principles consistently
 *
 * GLOW Principles:
 * 1. When cohortIds are provided, rely solely on cohort data (cohorts → simulations → attempts → chats → grades)
 * 2. When no cohortIds, rely solely on profiles (profiles → attempts → simulations → chats → grades)
 * 3. Date filter is for simulation attempts only
 * 4. Practice/General filters apply to simulations (mutually exclusive)
 * 5. Archived filter applies to simulation attempts (archived flag)
 * 6. ProfileId filtering is applied at attempt level only
 * 7. Only active simulations and scenarios are returned
 */
export function filterAnalyticsData(options: FilteringOptions): FilteredData {
  const {
    startDate,
    endDate,
    cohortIds = [],
    roles = [],
    simulationFilters = ["general"],
    profileId,
    allAttempts,
    allChats,
    allGrades,
    allFeedbacks,
    allSimulations,
    allScenarios,
    allProfiles,
    allCohorts,
    allMessages = [],
    allRubrics = [],
    allStandardGroups = [],
    allStandards = [],
  } = options;

  // Step 1: Determine filtering approach based on cohortIds
  const hasCohortFilter = cohortIds.length > 0;

  let filteredCohorts: Cohort[] = [];
  let filteredSimulations: Simulation[] = [];
  let filteredProfiles: Profile[] = [];

  if (hasCohortFilter) {
    // Approach 1: Cohort-based filtering
    // Filter cohorts based on selection
    filteredCohorts = allCohorts.filter(
      (cohort) => cohortIds.includes(cohort.id) && cohort.active
    );

    // Filter simulations based on cohorts and practice/general filters
    filteredSimulations = filterSimulationsByCohorts(
      allSimulations,
      filteredCohorts,
      simulationFilters
    );

    // Filter profiles based on cohort membership
    filteredProfiles = filterProfilesByCohorts(allProfiles, filteredCohorts);
  } else {
    // Approach 2: Profile-based filtering
    // Filter profiles based on roles
    const roleScopedProfiles = filterProfilesByRoles(allProfiles, roles);
    // Ensure the explicit profileId (if provided) is included even if role filter would exclude it
    if (profileId) {
      const explicitProfile = allProfiles.find((p) => p.id === profileId);
      if (
        explicitProfile &&
        !roleScopedProfiles.some((p) => p.id === explicitProfile.id)
      ) {
        roleScopedProfiles.push(explicitProfile);
      }
    }
    filteredProfiles = roleScopedProfiles;

    // Filter simulations based on practice/general filters (no cohort restriction)
    filteredSimulations = filterSimulationsByType(
      allSimulations,
      simulationFilters
    );

    // No explicit cohort filter provided; we'll derive cohorts after attempts are computed
    filteredCohorts = [];
  }

  // Step 2: Filter attempts based on date range, profiles, simulations, archived status, and profileId
  const filteredAttempts = filterAttempts(
    allAttempts,
    startDate,
    endDate,
    filteredProfiles,
    filteredSimulations,
    simulationFilters,
    profileId
  );

  // Derive cohorts when none explicitly provided: resolve by profile membership or all active
  if (!hasCohortFilter) {
    const profile = profileId
      ? allProfiles.find((p) => p.id === profileId)
      : undefined;
    const isAdminOrSuperadmin =
      profile?.role === "admin" || profile?.role === "superadmin";

    if (profileId && !isAdminOrSuperadmin) {
      // Non-admin user: include only active cohorts the profile belongs to
      filteredCohorts = allCohorts.filter(
        (cohort) => cohort.active && cohort.profileIds.includes(profileId)
      );
    } else {
      // Admin/superadmin or no profile context: include all active cohorts
      filteredCohorts = allCohorts.filter((cohort) => cohort.active);
    }
  }

  // Step 3: Filter chats based on filtered attempts
  const filteredChats = filterChats(allChats, filteredAttempts);

  // Step 4: Filter grades based on filtered chats
  const filteredGrades = filterGrades(allGrades, filteredChats);

  // Step 5: Filter feedbacks based on filtered grades
  const filteredFeedbacks = filterFeedbacks(allFeedbacks, filteredGrades);

  // Step 6: Derive scenarios from filtered simulations
  const filteredScenarios = deriveScenariosFromSimulations(
    allScenarios,
    filteredSimulations,
    filteredAttempts,
    filteredChats
  );

  // Step 7: Derive messages from filtered chats (if provided)
  const filteredMessages =
    Array.isArray(allMessages) && allMessages.length > 0
      ? allMessages.filter((m) => filteredChats.some((c) => c.id === m.chatId))
      : [];

  // Step 8: Derive rubrics and standards from filtered simulations (if provided)
  const rubricIds = new Set<string>(
    filteredSimulations.map((s) => s.rubricId).filter(Boolean) as string[]
  );
  const filteredRubrics = allRubrics.filter((r) => rubricIds.has(r.id));
  const filteredStandardGroups = allStandardGroups.filter((g) =>
    rubricIds.has(g.rubricId)
  );
  const stdGroupIds = new Set<string>(filteredStandardGroups.map((g) => g.id));
  const filteredStandards = allStandards.filter((s) =>
    stdGroupIds.has(s.standardGroupId)
  );

  // Step 9: Derive parameters/parameterItems/personas used by filtered scenarios (if provided)
  const allParamItems: ParameterItem[] = options.allParameterItems ?? [];
  const allParams: Parameter[] = options.allParameters ?? [];
  const allPeople: Persona[] = options.allPersonas ?? [];

  const usedParameterItemIds = new Set<string>();
  filteredScenarios.forEach((scenario) => {
    scenario.parameterItemIds?.forEach((id) => usedParameterItemIds.add(id));
  });
  const filteredParameterItems = allParamItems.filter((pi: ParameterItem) =>
    usedParameterItemIds.has(pi.id)
  );
  const usedParameterIds = new Set<string>(
    filteredParameterItems.map((pi: ParameterItem) => pi.parameterId)
  );
  const filteredParameters = allParams.filter((p: Parameter) =>
    usedParameterIds.has(p.id)
  );

  const usedPersonaIds = new Set<string>(
    filteredScenarios.map((s) => s.personaId).filter(Boolean) as string[]
  );
  const filteredPersonas = allPeople.filter((person: Persona) =>
    usedPersonaIds.has(person.id)
  );

  return {
    attempts: filteredAttempts,
    chats: filteredChats,
    grades: filteredGrades,
    feedbacks: filteredFeedbacks,
    messages: filteredMessages,
    simulations: filteredSimulations,
    scenarios: filteredScenarios,
    profiles: filteredProfiles,
    cohorts: filteredCohorts,
    rubrics: filteredRubrics,
    standardGroups: filteredStandardGroups,
    standards: filteredStandards,
    parameters: filteredParameters,
    parameterItems: filteredParameterItems,
    personas: filteredPersonas,
  };
}

/**
 * Filter simulations based on cohorts and practice/general filters
 */
function filterSimulationsByCohorts(
  allSimulations: Simulation[],
  filteredCohorts: Cohort[],
  simulationFilters: SimulationFilter[]
): Simulation[] {
  // Get all simulation IDs from the filtered cohorts
  const cohortSimulationIds = new Set<string>();
  filteredCohorts.forEach((cohort) => {
    cohort.simulationIds.forEach((simId) => {
      if (simId !== "RAY") {
        // Exclude placeholder
        cohortSimulationIds.add(simId);
      }
    });
  });

  // Filter simulations to those in the cohorts
  const filteredSimulations = allSimulations.filter((simulation) =>
    cohortSimulationIds.has(simulation.id)
  );

  // Apply practice/general filtering
  return filterSimulationsByType(filteredSimulations, simulationFilters);
}

/**
 * Filter simulations based on practice/general filters only
 */
function filterSimulationsByType(
  simulations: Simulation[],
  simulationFilters: SimulationFilter[]
): Simulation[] {
  // First filter to only active simulations
  const activeSimulations = simulations.filter(
    (simulation) => simulation.active
  );

  const hasPractice = simulationFilters.includes("practice");
  const hasGeneral = simulationFilters.includes("general");

  if (hasPractice && hasGeneral) {
    // Both selected - no additional filtering needed
    return activeSimulations;
  } else if (hasPractice) {
    // Only practice simulations
    return activeSimulations.filter((simulation) =>
      Boolean(simulation.practiceSimulation)
    );
  } else if (hasGeneral) {
    // Only general simulations
    return activeSimulations.filter(
      (simulation) => !simulation.practiceSimulation
    );
  } else {
    // Neither selected - return empty array
    return [];
  }
}

/**
 * Filter profiles based on cohort membership
 */
function filterProfilesByCohorts(
  allProfiles: Profile[],
  filteredCohorts: Cohort[]
): Profile[] {
  const cohortProfileIds = new Set<string>();
  filteredCohorts.forEach((cohort) => {
    cohort.profileIds.forEach((profileId) => {
      cohortProfileIds.add(profileId);
    });
  });

  return allProfiles.filter((profile) => cohortProfileIds.has(profile.id));
}

/**
 * Filter profiles based on roles
 */
function filterProfilesByRoles(
  allProfiles: Profile[],
  roles: ProfileRole[]
): Profile[] {
  if (roles.length === 0) {
    // No role filter - return all profiles
    return allProfiles;
  }

  return allProfiles.filter((profile) => roles.includes(profile.role));
}

/**
 * Filter attempts based on date range, profiles, simulations, archived status, and profileId
 * This is the primary date filtering point - all other date filtering should derive from this
 */
function filterAttempts(
  allAttempts: SimulationAttempt[],
  startDate: Date,
  endDate: Date,
  filteredProfiles: Profile[],
  filteredSimulations: Simulation[],
  simulationFilters: SimulationFilter[],
  profileId?: string
): SimulationAttempt[] {
  const profileIds = new Set(filteredProfiles.map((p) => p.id));
  const simulationIds = new Set(filteredSimulations.map((s) => s.id));

  const filteredAttempts = allAttempts.filter((attempt) => {
    // Filter by date range (attempt creation date)
    const attemptDate = new Date(attempt.createdAt);

    // Add a 5-minute buffer to the end date to include recent attempts
    const bufferedEndDate = new Date(endDate.getTime() + 5 * 60 * 1000); // 5 minutes buffer

    const inDateRange =
      isAfter(attemptDate, startDate) && isBefore(attemptDate, bufferedEndDate);

    if (!inDateRange) return false;

    // Filter by profile (from filtered profiles)
    if (!attempt.profileId || !profileIds.has(attempt.profileId)) {
      return false;
    }

    // Filter by simulation
    if (!simulationIds.has(attempt.simulationId)) {
      return false;
    }

    // Filter by specific profileId if provided
    if (profileId && attempt.profileId !== profileId) {
      return false;
    }

    // Filter by archived status
    const hasArchived = simulationFilters.includes("archived");
    const hasNonArchived =
      simulationFilters.includes("general") ||
      simulationFilters.includes("practice");

    if (hasArchived && hasNonArchived) {
      // Both archived and non-archived selected - no additional filtering
    } else if (hasArchived) {
      // Only archived attempts
      if (!attempt.archived) return false;
    } else if (hasNonArchived) {
      // Only non-archived attempts
      if (attempt.archived) return false;
    } else {
      // Neither selected - return false
      return false;
    }

    return true;
  });

  return filteredAttempts;
}

/**
 * Filter chats based on filtered attempts
 */
function filterChats(
  allChats: SimulationChat[],
  filteredAttempts: SimulationAttempt[]
): SimulationChat[] {
  const attemptIds = new Set(filteredAttempts.map((a) => a.id));

  return allChats.filter((chat) => attemptIds.has(chat.attemptId));
}

/**
 * Filter grades based on filtered chats
 */
function filterGrades(
  allGrades: SimulationChatGrade[],
  filteredChats: SimulationChat[]
): SimulationChatGrade[] {
  const chatIds = new Set(filteredChats.map((c) => c.id));

  return allGrades.filter((grade) => chatIds.has(grade.simulationChatId));
}

/**
 * Filter feedbacks based on filtered grades
 */
function filterFeedbacks(
  allFeedbacks: SimulationChatFeedback[],
  filteredGrades: SimulationChatGrade[]
): SimulationChatFeedback[] {
  const gradeIds = new Set(filteredGrades.map((g) => g.id));

  return allFeedbacks.filter((feedback) =>
    gradeIds.has(feedback.simulationChatGradeId)
  );
}

/**
 * Derive scenarios from filtered simulations
 */
function deriveScenariosFromSimulations(
  allScenarios: Scenario[],
  filteredSimulations: Simulation[],
  filteredAttempts: SimulationAttempt[],
  filteredChats: SimulationChat[]
): Scenario[] {
  // Get all scenario IDs from the actual data flow: attempts → chats → scenarios
  const scenarioIds = new Set<string>();

  // Get all attempt IDs from filtered simulations
  const filteredSimulationIds = new Set(filteredSimulations.map((s) => s.id));
  const relevantAttemptIds = filteredAttempts
    .filter((attempt) => filteredSimulationIds.has(attempt.simulationId))
    .map((attempt) => attempt.id);

  // Get all scenario IDs from chats that belong to these attempts
  filteredChats
    .filter((chat) => relevantAttemptIds.includes(chat.attemptId))
    .forEach((chat) => {
      if (chat.scenarioId && chat.scenarioId !== "RAY") {
        scenarioIds.add(chat.scenarioId);
      }
    });

  // ALSO include scenarios that are referenced in simulation.scenarioIds
  // This ensures practice simulations can show persona colors even without attempts
  filteredSimulations.forEach((simulation) => {
    simulation.scenarioIds?.forEach((scenarioId) => {
      if (scenarioId !== "RAY") {
        scenarioIds.add(scenarioId);
      }
    });
  });

  // Filter scenarios to those in the actual data flow and only active ones
  return allScenarios.filter(
    (scenario) => scenarioIds.has(scenario.id) && scenario.active
  );
}

/**
 * Helper function to get simulation IDs that are allowed based on current filters
 * This is useful for components that need to know which simulations are available
 */
export function getAllowedSimulationIds(
  cohorts: Cohort[],
  cohortIds: string[],
  _simulationFilters: SimulationFilter[]
): string[] | null {
  // If no cohort filtering, return null to indicate all simulations are allowed
  if (cohortIds.length === 0) {
    return null;
  }

  // Filter cohorts to only those in cohortIds
  const filteredCohorts = cohorts.filter(
    (cohort) => cohortIds.includes(cohort.id) && cohort.active
  );

  if (filteredCohorts.length === 0) {
    return []; // No matching cohorts, no data allowed
  }

  // Get union of all simulation IDs from matching cohorts
  const simulationIds = new Set<string>();
  filteredCohorts.forEach((cohort) => {
    cohort.simulationIds.forEach((simId) => {
      if (simId !== "RAY") {
        // Exclude placeholder
        simulationIds.add(simId);
      }
    });
  });

  return Array.from(simulationIds);
}

/**
 * Helper function to check if a simulation should be included based on practice/general filters
 */
export function isSimulationIncluded(
  simulation: Simulation | undefined,
  simulationFilters: SimulationFilter[]
): boolean {
  if (!simulation) return false;

  const isPractice = Boolean(simulation.practiceSimulation);
  const hasPractice = simulationFilters.includes("practice");
  const hasGeneral = simulationFilters.includes("general");

  return (hasPractice && isPractice) || (hasGeneral && !isPractice);
}
