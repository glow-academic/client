import { SimulationFilter } from "@/contexts/analytics-context";
import type {
  Cohort,
  Profile,
  ProfileRole,
  Simulation,
  SimulationAttempt,
  SimulationChat,
  SimulationChatGrade,
} from "@/types";
import { isAfter, isBefore } from "date-fns";

export interface FilteredData {
  // Core filtered data
  attempts: SimulationAttempt[];
  chats: SimulationChat[];
  grades: SimulationChatGrade[];

  // Derived data for convenience
  simulations: Simulation[];
  profiles: Profile[];
  cohorts: Cohort[];
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
  profileId?: string;

  // Raw data
  allAttempts: SimulationAttempt[];
  allChats: SimulationChat[];
  allGrades: SimulationChatGrade[];
  allSimulations: Simulation[];
  allProfiles: Profile[];
  allCohorts: Cohort[];
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
    allSimulations,
    allProfiles,
    allCohorts,
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
    filteredProfiles = filterProfilesByRoles(allProfiles, roles);

    // Filter simulations based on practice/general filters (no cohort restriction)
    filteredSimulations = filterSimulationsByType(
      allSimulations,
      simulationFilters
    );

    // No cohort filtering when using profile-based approach
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

  // Step 3: Filter chats based on filtered attempts
  const filteredChats = filterChats(allChats, filteredAttempts);

  // Step 4: Filter grades based on filtered chats
  const filteredGrades = filterGrades(allGrades, filteredChats);

  return {
    attempts: filteredAttempts,
    chats: filteredChats,
    grades: filteredGrades,
    simulations: filteredSimulations,
    profiles: filteredProfiles,
    cohorts: filteredCohorts,
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
  const hasPractice = simulationFilters.includes("practice");
  const hasGeneral = simulationFilters.includes("general");

  if (hasPractice && hasGeneral) {
    // Both selected - no additional filtering needed
    return simulations;
  } else if (hasPractice) {
    // Only practice simulations
    return simulations.filter((simulation) =>
      Boolean(simulation.practiceSimulation)
    );
  } else if (hasGeneral) {
    // Only general simulations
    return simulations.filter((simulation) => !simulation.practiceSimulation);
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

  return allAttempts.filter((attempt) => {
    // Filter by date range (attempt creation date)
    const attemptDate = new Date(attempt.createdAt);
    const inDateRange =
      isAfter(attemptDate, startDate) && isBefore(attemptDate, endDate);

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
