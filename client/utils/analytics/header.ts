import type {
  Cohort,
  ProfileRole,
  Rubric,
  Simulation,
  SimulationAttempt,
  SimulationChat,
  SimulationChatGrade,
  SimulationMessage,
} from "@/types";
import { eachDayOfInterval, format } from "date-fns";

// Common interfaces for analytics data
export interface AnalyticsDataPoint {
  date: string; // MM/dd format
  value: number;
  count: number; // Number of sessions/attempts for this day
}

export interface AnalyticsResult {
  currentValue: number;
  trendData: AnalyticsDataPoint[];
  hasData: boolean;
}

// Common filtering function for cohort restrictions
function getAllowedSimulationIds(
  cohorts: Cohort[],
  cohortIds: string[],
  profileId?: string
): string[] | null {
  if (!cohortIds || cohortIds.length === 0) {
    return null; // No cohort filtering, allow all simulations
  }

  // Filter cohorts to only those in cohortIds
  const filteredCohorts = cohorts.filter((cohort) =>
    cohortIds.includes(cohort.id)
  );

  if (filteredCohorts.length === 0) {
    return []; // No matching cohorts, no data allowed
  }

  // If profileId is provided, check if profile belongs to any of the filtered cohorts
  if (profileId) {
    const profileInCohorts = filteredCohorts.some((cohort) =>
      cohort.profileIds.includes(profileId)
    );

    if (!profileInCohorts) {
      return []; // Profile not in any of the specified cohorts, no data allowed
    }
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

// Common filtering function for date range and profile
function filterDataByDateAndProfile<T extends { createdAt: string }>(
  data: T[],
  dateStart: Date,
  dateEnd: Date,
  profileId?: string,
  getProfileId?: (item: T) => string
): T[] {
  return data.filter((item) => {
    const itemDate = new Date(item.createdAt);
    const inDateRange = itemDate >= dateStart && itemDate <= dateEnd;

    if (!inDateRange) return false;

    if (profileId && getProfileId) {
      return getProfileId(item) === profileId;
    }

    return true;
  });
}

// Helper to include simulations based on practice vs normal flags
function isIncludedByPractice(
  simulation: { practiceSimulation?: boolean } | undefined,
  showPractice: boolean,
  showNormal: boolean
): boolean {
  if (!simulation) return false;
  const isPractice = Boolean(simulation.practiceSimulation);
  return (showPractice && isPractice) || (showNormal && !isPractice);
}

/**
 * Calculate average score across all simulation attempts
 * @param grades - All simulation chat grades
 * @param chats - All simulation chats
 * @param attempts - All simulation attempts
 * @param simulations - All simulations
 * @param rubrics - All rubrics
 * @param dateStart - Start date for filtering
 * @param dateEnd - End date for filtering
 * @param profileId - Optional profile ID to filter by
 * @param cohorts - All cohorts for cohort filtering
 * @param cohortIds - Array of cohort IDs to filter by
 * @returns AnalyticsResult with average score and trend data
 */
export const calculateAverageScore = (
  grades: SimulationChatGrade[],
  chats: SimulationChat[],
  attempts: SimulationAttempt[],
  simulations: Simulation[],
  rubrics: Rubric[],
  dateStart: Date,
  dateEnd: Date,
  profileId?: string,
  cohorts: Cohort[] = [],
  cohortIds: string[] = [],
  rolesAllowed?: ProfileRole[],
  showPractice: boolean = false,
  profiles?: { id: string; role: ProfileRole }[],
  showNormal: boolean = true
): AnalyticsResult => {
  const allowedSimulationIds = getAllowedSimulationIds(
    cohorts,
    cohortIds,
    profileId
  );

  // Filter grades by date range
  const filteredGrades = filterDataByDateAndProfile(grades, dateStart, dateEnd);

  // Filter by profileId if provided and optionally include practice simulations
  let profileFilteredGrades = profileId
    ? filteredGrades.filter((grade) => {
        const chat = chats.find((c) => c.id === grade.simulationChatId);
        const attempt = attempts.find((a) => a.id === chat?.attemptId);
        const simulation = simulations.find(
          (s) => s.id === attempt?.simulationId
        );
        return (
          attempt?.profileId === profileId &&
          isIncludedByPractice(simulation, showPractice, showNormal)
        );
      })
    : filteredGrades.filter((grade) => {
        const chat = chats.find((c) => c.id === grade.simulationChatId);
        const attempt = attempts.find((a) => a.id === chat?.attemptId);
        const simulation = simulations.find(
          (s) => s.id === attempt?.simulationId
        );
        return isIncludedByPractice(simulation, showPractice, showNormal);
      });

  // Apply role filtering if provided and profiles are available
  if (rolesAllowed && rolesAllowed.length > 0 && profiles) {
    profileFilteredGrades = profileFilteredGrades.filter((grade) => {
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      const profile = profiles.find((p) => p.id === attempt?.profileId);
      return profile ? rolesAllowed.includes(profile.role) : false;
    });
  }

  // Apply cohort filtering if simulation IDs are restricted
  if (allowedSimulationIds !== null) {
    if (allowedSimulationIds.length === 0) {
      return { currentValue: 0, trendData: [], hasData: false };
    }

    profileFilteredGrades = profileFilteredGrades.filter((grade) => {
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      return allowedSimulationIds.includes(attempt?.simulationId || "");
    });
  }

  if (profileFilteredGrades.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Calculate average score using rubric points
  const scoreSum = profileFilteredGrades.reduce((sum, grade) => {
    const chat = chats.find((c) => c.id === grade.simulationChatId);
    const attempt = attempts.find((a) => a.id === chat?.attemptId);
    const simulation = simulations.find((s) => s.id === attempt?.simulationId);
    const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
    const rubricTotalPoints = rubric?.points || 100;
    const scorePercent = Math.round((grade.score / rubricTotalPoints) * 100);
    return sum + scorePercent;
  }, 0);

  const currentValue = Math.round(scoreSum / profileFilteredGrades.length);

  // Calculate trend data
  const days = eachDayOfInterval({ start: dateStart, end: dateEnd });
  const trendData: AnalyticsDataPoint[] = days.map((date) => {
    const dateStr = format(date, "yyyy-MM-dd");

    const dayGrades = profileFilteredGrades.filter((grade) => {
      const gradeDate = format(new Date(grade.createdAt), "yyyy-MM-dd");
      return gradeDate === dateStr;
    });

    let avgScore = 0;
    if (dayGrades.length > 0) {
      const dayScoreSum = dayGrades.reduce((sum, grade) => {
        const chat = chats.find((c) => c.id === grade.simulationChatId);
        const attempt = attempts.find((a) => a.id === chat?.attemptId);
        const simulation = simulations.find(
          (s) => s.id === attempt?.simulationId
        );
        const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
        const rubricTotalPoints = rubric?.points || 100;
        const scorePercent = Math.round(
          (grade.score / rubricTotalPoints) * 100
        );
        return sum + scorePercent;
      }, 0);
      avgScore = Math.round(dayScoreSum / dayGrades.length);
    }

    return {
      date: format(date, "MM/dd"),
      value: avgScore,
      count: dayGrades.length,
    };
  });

  return {
    currentValue,
    trendData,
    hasData: trendData.some((day) => day.count > 0),
  };
};

/**
 * Calculate completion percentage (percentage of chats that passed)
 * @param chats - All simulation chats
 * @param grades - All simulation chat grades
 * @param attempts - All simulation attempts
 * @param simulations - All simulations
 * @param dateStart - Start date for filtering
 * @param dateEnd - End date for filtering
 * @param profileId - Optional profile ID to filter by
 * @param cohorts - All cohorts for cohort filtering
 * @param cohortIds - Array of cohort IDs to filter by
 * @returns AnalyticsResult with completion percentage and trend data
 */
export const calculateCompletionPercentage = (
  chats: SimulationChat[],
  grades: SimulationChatGrade[],
  attempts: SimulationAttempt[],
  simulations: Simulation[],
  dateStart: Date,
  dateEnd: Date,
  profileId?: string,
  cohorts: Cohort[] = [],
  cohortIds: string[] = [],
  rolesAllowed?: ProfileRole[],
  showPractice: boolean = false,
  profiles?: { id: string; role: ProfileRole }[],
  showNormal: boolean = true
): AnalyticsResult => {
  const allowedSimulationIds = getAllowedSimulationIds(
    cohorts,
    cohortIds,
    profileId
  );

  // Filter chats by date range
  const filteredChats = filterDataByDateAndProfile(chats, dateStart, dateEnd);

  // Filter by profileId if provided and exclude practice simulations
  const profileFilteredChats = profileId
    ? filteredChats.filter((chat) => {
        const attempt = attempts?.find((a) => a.id === chat.attemptId);
        return attempt?.profileId === profileId;
      })
    : filteredChats;

  // Filter out practice simulations unless showPractice is true
  let nonPracticeChats = profileFilteredChats.filter((chat) => {
    const attempt = attempts?.find((a) => a.id === chat.attemptId);
    const simulation = simulations?.find((s) => s.id === attempt?.simulationId);
    return isIncludedByPractice(simulation, showPractice, showNormal);
  });

  // Role filtering
  if (rolesAllowed && rolesAllowed.length > 0 && profiles) {
    nonPracticeChats = nonPracticeChats.filter((chat) => {
      const attempt = attempts?.find((a) => a.id === chat.attemptId);
      const prof = profiles.find((p) => p.id === attempt?.profileId);
      return prof ? rolesAllowed.includes(prof.role) : false;
    });
  }

  // Apply cohort filtering if simulation IDs are restricted
  if (allowedSimulationIds !== null) {
    if (allowedSimulationIds.length === 0) {
      return { currentValue: 0, trendData: [], hasData: false };
    }

    nonPracticeChats = nonPracticeChats.filter((chat) => {
      const attempt = attempts?.find((a) => a.id === chat.attemptId);
      return allowedSimulationIds.includes(attempt?.simulationId || "");
    });
  }

  if (nonPracticeChats.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Count chats with passing grades
  const passingChats = nonPracticeChats.filter((chat) => {
    const chatGrade = grades.find(
      (grade) => grade.simulationChatId === chat.id
    );
    return chatGrade?.passed === true;
  });

  const currentValue = Math.round(
    (passingChats.length / nonPracticeChats.length) * 100
  );

  // Calculate trend data
  const days = eachDayOfInterval({ start: dateStart, end: dateEnd });
  const trendData: AnalyticsDataPoint[] = days.map((date) => {
    const dateStr = format(date, "yyyy-MM-dd");

    const dayChats = nonPracticeChats.filter((chat) => {
      const chatDate = format(new Date(chat.createdAt), "yyyy-MM-dd");
      return chatDate === dateStr;
    });

    let completionRate = 0;
    if (dayChats.length > 0) {
      const passingDayChats = dayChats.filter((chat) => {
        const chatGrade = grades.find(
          (grade) => grade.simulationChatId === chat.id
        );
        return chatGrade?.passed === true;
      });
      completionRate = Math.round(
        (passingDayChats.length / dayChats.length) * 100
      );
    }

    return {
      date: format(date, "MM/dd"),
      value: completionRate,
      count: dayChats.length,
    };
  });

  return {
    currentValue,
    trendData,
    hasData: trendData.some((day) => day.count > 0),
  };
};

/**
 * Calculate first attempt pass rate (percentage of first attempts that passed)
 * @param attempts - All simulation attempts
 * @param chats - All simulation chats
 * @param grades - All simulation chat grades
 * @param simulations - All simulations
 * @param dateStart - Start date for filtering
 * @param dateEnd - End date for filtering
 * @param profileId - Optional profile ID to filter by
 * @param cohorts - All cohorts for cohort filtering
 * @param cohortIds - Array of cohort IDs to filter by
 * @returns AnalyticsResult with first attempt pass rate and trend data
 */
export const calculateFirstAttemptPassRate = (
  attempts: SimulationAttempt[],
  chats: SimulationChat[],
  grades: SimulationChatGrade[],
  simulations: Simulation[],
  dateStart: Date,
  dateEnd: Date,
  profileId?: string,
  cohorts: Cohort[] = [],
  cohortIds: string[] = [],
  rolesAllowed?: ProfileRole[],
  showPractice: boolean = false,
  profiles?: { id: string; role: ProfileRole }[],
  showNormal: boolean = true
): AnalyticsResult => {
  const allowedSimulationIds = getAllowedSimulationIds(
    cohorts,
    cohortIds,
    profileId
  );

  // Filter attempts by date range and optionally include practice simulations
  const filteredAttempts = attempts.filter((attempt) => {
    const attemptDate = new Date(attempt.createdAt);
    const simulation = simulations.find((s) => s.id === attempt.simulationId);
    if (!(attemptDate >= dateStart && attemptDate <= dateEnd)) return false;
    if (!isIncludedByPractice(simulation, showPractice, showNormal))
      return false;
    if (rolesAllowed && rolesAllowed.length > 0 && profiles) {
      const prof = profiles.find((p) => p.id === attempt.profileId);
      if (!prof || !rolesAllowed.includes(prof.role)) return false;
    }
    return true;
  });

  // Filter by profileId if provided
  let profileFilteredAttempts = profileId
    ? filteredAttempts.filter((attempt) => attempt.profileId === profileId)
    : filteredAttempts;

  // Apply cohort filtering if simulation IDs are restricted
  if (allowedSimulationIds !== null) {
    if (allowedSimulationIds.length === 0) {
      return { currentValue: 0, trendData: [], hasData: false };
    }

    profileFilteredAttempts = profileFilteredAttempts.filter((attempt) =>
      allowedSimulationIds.includes(attempt.simulationId)
    );
  }

  if (profileFilteredAttempts.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Group attempts by profileId + simulationId to find first attempts
  const firstAttempts = profileFilteredAttempts.reduce(
    (acc, attempt) => {
      const key = `${attempt.profileId}-${attempt.simulationId}`;
      if (
        !acc[key] ||
        new Date(attempt.createdAt) < new Date(acc[key].createdAt)
      ) {
        acc[key] = attempt;
      }
      return acc;
    },
    {} as Record<string, SimulationAttempt>
  );

  const firstAttemptsList = Object.values(firstAttempts);

  // Count first attempts that passed (have at least one chat with passed grade)
  const passedFirstAttempts = firstAttemptsList.filter((attempt) => {
    const attemptChats = chats.filter((chat) => chat.attemptId === attempt.id);
    return attemptChats.some((chat) => {
      const chatGrade = grades.find(
        (grade) => grade.simulationChatId === chat.id
      );
      return chatGrade?.passed === true;
    });
  });

  const currentValue = Math.round(
    (passedFirstAttempts.length / firstAttemptsList.length) * 100
  );

  // Calculate trend data
  const days = eachDayOfInterval({ start: dateStart, end: dateEnd });
  const trendData: AnalyticsDataPoint[] = days.map((date) => {
    const dateStr = format(date, "yyyy-MM-dd");

    const dayAttempts = profileFilteredAttempts.filter((attempt) => {
      const attemptDate = format(new Date(attempt.createdAt), "yyyy-MM-dd");
      return attemptDate === dateStr;
    });

    // Group attempts by profileId + simulationId to find first attempts for this day
    const dayFirstAttempts = dayAttempts.reduce(
      (acc, attempt) => {
        const key = `${attempt.profileId}-${attempt.simulationId}`;
        if (
          !acc[key] ||
          new Date(attempt.createdAt) < new Date(acc[key].createdAt)
        ) {
          acc[key] = attempt;
        }
        return acc;
      },
      {} as Record<string, SimulationAttempt>
    );

    const dayFirstAttemptsList = Object.values(dayFirstAttempts);

    let passRate = 0;
    if (dayFirstAttemptsList.length > 0) {
      const passedDayFirstAttempts = dayFirstAttemptsList.filter((attempt) => {
        const attemptChats = chats.filter(
          (chat) => chat.attemptId === attempt.id
        );
        return attemptChats.some((chat) => {
          const chatGrade = grades.find(
            (grade) => grade.simulationChatId === chat.id
          );
          return chatGrade?.passed === true;
        });
      });
      passRate = Math.round(
        (passedDayFirstAttempts.length / dayFirstAttemptsList.length) * 100
      );
    }

    return {
      date: format(date, "MM/dd"),
      value: passRate,
      count: dayFirstAttemptsList.length,
    };
  });

  return {
    currentValue,
    trendData,
    hasData: trendData.some((day) => day.count > 0),
  };
};

/**
 * Calculate highest score achieved
 * @param grades - All simulation chat grades
 * @param chats - All simulation chats
 * @param attempts - All simulation attempts
 * @param simulations - All simulations
 * @param rubrics - All rubrics
 * @param dateStart - Start date for filtering
 * @param dateEnd - End date for filtering
 * @param profileId - Optional profile ID to filter by
 * @param cohorts - All cohorts for cohort filtering
 * @param cohortIds - Array of cohort IDs to filter by
 * @returns AnalyticsResult with highest score and trend data
 */
export const calculateHighestScore = (
  grades: SimulationChatGrade[],
  chats: SimulationChat[],
  attempts: SimulationAttempt[],
  simulations: Simulation[],
  rubrics: Rubric[],
  dateStart: Date,
  dateEnd: Date,
  profileId?: string,
  cohorts: Cohort[] = [],
  cohortIds: string[] = [],
  rolesAllowed?: ProfileRole[],
  showPractice: boolean = false,
  profiles?: { id: string; role: ProfileRole }[],
  showNormal: boolean = true
): AnalyticsResult => {
  const allowedSimulationIds = getAllowedSimulationIds(
    cohorts,
    cohortIds,
    profileId
  );

  // Filter grades by date range
  const filteredGrades = filterDataByDateAndProfile(grades, dateStart, dateEnd);

  // Filter by profileId if provided and optionally include practice simulations
  let profileFilteredGrades = profileId
    ? filteredGrades.filter((grade) => {
        const chat = chats.find((c) => c.id === grade.simulationChatId);
        const attempt = attempts.find((a) => a.id === chat?.attemptId);
        const simulation = simulations.find(
          (s) => s.id === attempt?.simulationId
        );
        return (
          attempt?.profileId === profileId &&
          isIncludedByPractice(simulation, showPractice, showNormal)
        );
      })
    : filteredGrades.filter((grade) => {
        const chat = chats.find((c) => c.id === grade.simulationChatId);
        const attempt = attempts.find((a) => a.id === chat?.attemptId);
        const simulation = simulations.find(
          (s) => s.id === attempt?.simulationId
        );
        return isIncludedByPractice(simulation, showPractice, showNormal);
      });

  // Apply role filtering if provided and profiles are available
  if (rolesAllowed && rolesAllowed.length > 0 && profiles) {
    profileFilteredGrades = profileFilteredGrades.filter((grade) => {
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      const profile = profiles.find((p) => p.id === attempt?.profileId);
      return profile ? rolesAllowed.includes(profile.role) : false;
    });
  }

  // Apply cohort filtering if simulation IDs are restricted
  if (allowedSimulationIds !== null) {
    if (allowedSimulationIds.length === 0) {
      return { currentValue: 0, trendData: [], hasData: false };
    }

    profileFilteredGrades = profileFilteredGrades.filter((grade) => {
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      return allowedSimulationIds.includes(attempt?.simulationId || "");
    });
  }

  if (profileFilteredGrades.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Calculate highest score using rubric points
  const highestScore = Math.max(
    ...profileFilteredGrades.map((grade) => {
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      const simulation = simulations.find(
        (s) => s.id === attempt?.simulationId
      );
      const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
      const rubricTotalPoints = rubric?.points || 100;
      return Math.round((grade.score / rubricTotalPoints) * 100);
    })
  );

  // Calculate trend data
  const days = eachDayOfInterval({ start: dateStart, end: dateEnd });
  const trendData: AnalyticsDataPoint[] = days.map((date) => {
    const dateStr = format(date, "yyyy-MM-dd");

    const dayGrades = profileFilteredGrades.filter((grade) => {
      const gradeDate = format(new Date(grade.createdAt), "yyyy-MM-dd");
      return gradeDate === dateStr;
    });

    let dayHighestScore = 0;
    if (dayGrades.length > 0) {
      dayHighestScore = Math.max(
        ...dayGrades.map((grade) => {
          const chat = chats.find((c) => c.id === grade.simulationChatId);
          const attempt = attempts.find((a) => a.id === chat?.attemptId);
          const simulation = simulations.find(
            (s) => s.id === attempt?.simulationId
          );
          const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
          const rubricTotalPoints = rubric?.points || 100;
          return Math.round((grade.score / rubricTotalPoints) * 100);
        })
      );
    }

    return {
      date: format(date, "MM/dd"),
      value: dayHighestScore,
      count: dayGrades.length,
    };
  });

  return {
    currentValue: highestScore,
    trendData,
    hasData: trendData.some((day) => day.count > 0),
  };
};

/**
 * Calculate average messages per session
 * @param messages - All simulation messages
 * @param chats - All simulation chats
 * @param attempts - All simulation attempts
 * @param simulations - All simulations
 * @param dateStart - Start date for filtering
 * @param dateEnd - End date for filtering
 * @param profileId - Optional profile ID to filter by
 * @param cohorts - All cohorts for cohort filtering
 * @param cohortIds - Array of cohort IDs to filter by
 * @returns AnalyticsResult with average messages per session and trend data
 */
export const calculateMessagesPerSession = (
  messages: SimulationMessage[],
  chats: SimulationChat[],
  attempts: SimulationAttempt[],
  simulations: Simulation[],
  dateStart: Date,
  dateEnd: Date,
  profileId?: string,
  cohorts: Cohort[] = [],
  cohortIds: string[] = [],
  rolesAllowed?: ProfileRole[],
  showPractice: boolean = false,
  profiles?: { id: string; role: ProfileRole }[],
  showNormal: boolean = true
): AnalyticsResult => {
  const allowedSimulationIds = getAllowedSimulationIds(
    cohorts,
    cohortIds,
    profileId
  );

  // Filter chats by date range
  const filteredChats = filterDataByDateAndProfile(chats, dateStart, dateEnd);

  // Filter by profileId if provided and exclude practice simulations
  const profileFilteredChats = profileId
    ? filteredChats.filter((chat) => {
        const attempt = attempts?.find((a) => a.id === chat.attemptId);
        return attempt?.profileId === profileId;
      })
    : filteredChats;

  // Filter out practice simulations unless showPractice is true
  let nonPracticeChats = profileFilteredChats.filter((chat) => {
    const attempt = attempts?.find((a) => a.id === chat.attemptId);
    const simulation = simulations?.find((s) => s.id === attempt?.simulationId);
    if (!isIncludedByPractice(simulation, showPractice, showNormal))
      return false;
    if (rolesAllowed && rolesAllowed.length > 0 && profiles) {
      const prof = profiles.find((p) => p.id === attempt?.profileId);
      if (!prof || !rolesAllowed.includes(prof.role)) return false;
    }
    return true;
  });

  // Apply cohort filtering if simulation IDs are restricted
  if (allowedSimulationIds !== null) {
    if (allowedSimulationIds.length === 0) {
      return { currentValue: 0, trendData: [], hasData: false };
    }

    nonPracticeChats = nonPracticeChats.filter((chat) => {
      const attempt = attempts?.find((a) => a.id === chat.attemptId);
      return allowedSimulationIds.includes(attempt?.simulationId || "");
    });
  }

  if (nonPracticeChats.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Calculate messages per session
  const totalMessages = nonPracticeChats.reduce((sum, chat) => {
    const chatMessages = messages.filter((msg) => msg.chatId === chat.id);
    return sum + chatMessages.length;
  }, 0);

  const currentValue = Math.round(totalMessages / nonPracticeChats.length);

  // Calculate trend data
  const days = eachDayOfInterval({ start: dateStart, end: dateEnd });
  const trendData: AnalyticsDataPoint[] = days.map((date) => {
    const dateStr = format(date, "yyyy-MM-dd");

    const dayChats = nonPracticeChats.filter((chat) => {
      const chatDate = format(new Date(chat.createdAt), "yyyy-MM-dd");
      return chatDate === dateStr;
    });

    let avgMessages = 0;
    if (dayChats.length > 0) {
      const dayTotalMessages = dayChats.reduce((sum, chat) => {
        const chatMessages = messages.filter((msg) => msg.chatId === chat.id);
        return sum + chatMessages.length;
      }, 0);
      avgMessages = Math.round(dayTotalMessages / dayChats.length);
    }

    return {
      date: format(date, "MM/dd"),
      value: avgMessages,
      count: dayChats.length,
    };
  });

  return {
    currentValue,
    trendData,
    hasData: trendData.some((day) => day.count > 0),
  };
};

/**
 * Calculate average persona response times
 * @param messages - All simulation messages
 * @param chats - All simulation chats
 * @param attempts - All simulation attempts
 * @param simulations - All simulations
 * @param dateStart - Start date for filtering
 * @param dateEnd - End date for filtering
 * @param profileId - Optional profile ID to filter by
 * @param cohorts - All cohorts for cohort filtering
 * @param cohortIds - Array of cohort IDs to filter by
 * @returns AnalyticsResult with average response time and trend data
 */
export const calculatePersonaResponseTimes = (
  messages: SimulationMessage[],
  chats: SimulationChat[],
  attempts: SimulationAttempt[],
  simulations: Simulation[],
  dateStart: Date,
  dateEnd: Date,
  profileId?: string,
  cohorts: Cohort[] = [],
  cohortIds: string[] = [],
  rolesAllowed?: ProfileRole[],
  showPractice: boolean = false,
  profiles?: { id: string; role: ProfileRole }[],
  showNormal: boolean = true
): AnalyticsResult => {
  const allowedSimulationIds = getAllowedSimulationIds(
    cohorts,
    cohortIds,
    profileId
  );

  // Filter chats by date range
  const filteredChats = filterDataByDateAndProfile(chats, dateStart, dateEnd);

  // Filter by profileId if provided and exclude practice simulations
  const profileFilteredChats = profileId
    ? filteredChats.filter((chat) => {
        const attempt = attempts?.find((a) => a.id === chat.attemptId);
        return attempt?.profileId === profileId;
      })
    : filteredChats;

  // Filter out practice simulations unless showPractice is true
  let nonPracticeChats = profileFilteredChats.filter((chat) => {
    const attempt = attempts?.find((a) => a.id === chat.attemptId);
    const simulation = simulations?.find((s) => s.id === attempt?.simulationId);
    if (!isIncludedByPractice(simulation, showPractice, showNormal))
      return false;
    if (rolesAllowed && rolesAllowed.length > 0 && profiles) {
      const prof = profiles.find((p) => p.id === attempt?.profileId);
      if (!prof || !rolesAllowed.includes(prof.role)) return false;
    }
    return true;
  });

  // Role filter already applied above when profiles are provided

  // Apply cohort filtering if simulation IDs are restricted
  if (allowedSimulationIds !== null) {
    if (allowedSimulationIds.length === 0) {
      return { currentValue: 0, trendData: [], hasData: false };
    }

    nonPracticeChats = nonPracticeChats.filter((chat) => {
      const attempt = attempts?.find((a) => a.id === chat.attemptId);
      return allowedSimulationIds.includes(attempt?.simulationId || "");
    });
  }

  if (nonPracticeChats.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Calculate response times
  const responseTimes: number[] = [];
  nonPracticeChats.forEach((chat) => {
    const chatMessages = messages
      .filter((msg) => msg.chatId === chat.id)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

    for (let i = 1; i < chatMessages.length; i++) {
      const currentMessage = chatMessages[i];
      const previousMessage = chatMessages[i - 1];

      if (
        currentMessage &&
        previousMessage &&
        currentMessage.type === "response" &&
        previousMessage.type === "query"
      ) {
        const responseTime =
          new Date(currentMessage.createdAt).getTime() -
          new Date(previousMessage.createdAt).getTime();
        responseTimes.push(responseTime / 1000); // Convert to seconds
      }
    }
  });

  const currentValue =
    responseTimes.length > 0
      ? Math.round(
          responseTimes.reduce((sum, time) => sum + time, 0) /
            responseTimes.length
        )
      : 0;

  // Calculate trend data
  const days = eachDayOfInterval({ start: dateStart, end: dateEnd });
  const trendData: AnalyticsDataPoint[] = days.map((date) => {
    const dateStr = format(date, "yyyy-MM-dd");

    const dayChats = nonPracticeChats.filter((chat) => {
      const chatDate = format(new Date(chat.createdAt), "yyyy-MM-dd");
      return chatDate === dateStr;
    });

    const dayResponseTimes: number[] = [];
    dayChats.forEach((chat) => {
      const chatMessages = messages
        .filter((msg) => msg.chatId === chat.id)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

      for (let i = 1; i < chatMessages.length; i++) {
        const currentMessage = chatMessages[i];
        const previousMessage = chatMessages[i - 1];

        if (
          currentMessage &&
          previousMessage &&
          currentMessage.type === "response" &&
          previousMessage.type === "query"
        ) {
          const responseTime =
            new Date(currentMessage.createdAt).getTime() -
            new Date(previousMessage.createdAt).getTime();
          dayResponseTimes.push(responseTime / 1000);
        }
      }
    });

    const avgResponseTime =
      dayResponseTimes.length > 0
        ? Math.round(
            dayResponseTimes.reduce((sum, time) => sum + time, 0) /
              dayResponseTimes.length
          )
        : 0;

    return {
      date: format(date, "MM/dd"),
      value: avgResponseTime,
      count: dayChats.length,
    };
  });

  return {
    currentValue,
    trendData,
    hasData: trendData.some((day) => day.count > 0),
  };
};

/**
 * Calculate session efficiency (average score / average time per session)
 * @param grades - All simulation chat grades
 * @param chats - All simulation chats
 * @param attempts - All simulation attempts
 * @param simulations - All simulations
 * @param rubrics - All rubrics
 * @param dateStart - Start date for filtering
 * @param dateEnd - End date for filtering
 * @param profileId - Optional profile ID to filter by
 * @param cohorts - All cohorts for cohort filtering
 * @param cohortIds - Array of cohort IDs to filter by
 * @returns AnalyticsResult with session efficiency and trend data
 */
export const calculateSessionEfficiency = (
  grades: SimulationChatGrade[],
  chats: SimulationChat[],
  attempts: SimulationAttempt[],
  simulations: Simulation[],
  rubrics: Rubric[],
  dateStart: Date,
  dateEnd: Date,
  profileId?: string,
  cohorts: Cohort[] = [],
  cohortIds: string[] = [],
  rolesAllowed?: ProfileRole[],
  showPractice: boolean = false,
  profiles?: { id: string; role: ProfileRole }[],
  showNormal: boolean = true
): AnalyticsResult => {
  const allowedSimulationIds = getAllowedSimulationIds(
    cohorts,
    cohortIds,
    profileId
  );

  // Filter grades by date range
  const filteredGrades = filterDataByDateAndProfile(grades, dateStart, dateEnd);

  // Filter by profileId if provided and optionally include practice simulations
  let profileFilteredGrades = profileId
    ? filteredGrades.filter((grade) => {
        const chat = chats.find((c) => c.id === grade.simulationChatId);
        const attempt = attempts.find((a) => a.id === chat?.attemptId);
        const simulation = simulations.find(
          (s) => s.id === attempt?.simulationId
        );
        return (
          attempt?.profileId === profileId &&
          isIncludedByPractice(simulation, showPractice, showNormal)
        );
      })
    : filteredGrades.filter((grade) => {
        const chat = chats.find((c) => c.id === grade.simulationChatId);
        const attempt = attempts.find((a) => a.id === chat?.attemptId);
        const simulation = simulations.find(
          (s) => s.id === attempt?.simulationId
        );
        return isIncludedByPractice(simulation, showPractice, showNormal);
      });

  // Apply role filtering if provided and profiles are available
  if (rolesAllowed && rolesAllowed.length > 0 && profiles) {
    profileFilteredGrades = profileFilteredGrades.filter((grade) => {
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      const profile = profiles.find((p) => p.id === attempt?.profileId);
      return profile ? rolesAllowed.includes(profile.role) : false;
    });
  }

  // Apply cohort filtering if simulation IDs are restricted
  if (allowedSimulationIds !== null) {
    if (allowedSimulationIds.length === 0) {
      return { currentValue: 0, trendData: [], hasData: false };
    }

    profileFilteredGrades = profileFilteredGrades.filter((grade) => {
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      return allowedSimulationIds.includes(attempt?.simulationId || "");
    });
  }

  if (profileFilteredGrades.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Calculate average score percentage
  const scores = profileFilteredGrades.map((grade) => {
    const chat = chats.find((c) => c.id === grade.simulationChatId);
    const attempt = attempts.find((a) => a.id === chat?.attemptId);
    const simulation = simulations.find((s) => s.id === attempt?.simulationId);
    const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
    const rubricTotalPoints = rubric?.points || 100;
    return Math.round((grade.score / rubricTotalPoints) * 100);
  });

  const averageScore =
    scores.reduce((sum, score) => sum + score, 0) / scores.length;

  // Calculate average time per session in minutes
  const timesInMinutes = profileFilteredGrades.map((grade) => {
    return grade.timeTaken / 60; // Convert seconds to minutes
  });

  const averageTimeInMinutes =
    timesInMinutes.reduce((sum, time) => sum + time, 0) / timesInMinutes.length;

  // Avoid division by zero
  if (averageTimeInMinutes === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Calculate efficiency: (Average Score %) / (Average Time per Session in minutes)
  const currentValue =
    Math.round((averageScore / averageTimeInMinutes) * 10) / 10;

  // Calculate trend data
  const days = eachDayOfInterval({ start: dateStart, end: dateEnd });
  const trendData: AnalyticsDataPoint[] = days.map((date) => {
    const dateStr = format(date, "yyyy-MM-dd");

    const dayGrades = profileFilteredGrades.filter((grade) => {
      const gradeDate = format(new Date(grade.createdAt), "yyyy-MM-dd");
      return gradeDate === dateStr;
    });

    let dayEfficiency = 0;
    if (dayGrades.length > 0) {
      // Calculate average score percentage for the day
      const dayScores = dayGrades.map((grade) => {
        const chat = chats.find((c) => c.id === grade.simulationChatId);
        const attempt = attempts.find((a) => a.id === chat?.attemptId);
        const simulation = simulations.find(
          (s) => s.id === attempt?.simulationId
        );
        const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
        const rubricTotalPoints = rubric?.points || 100;
        return Math.round((grade.score / rubricTotalPoints) * 100);
      });

      const dayAverageScore =
        dayScores.reduce((sum, score) => sum + score, 0) / dayScores.length;

      // Calculate average time per session in minutes for the day
      const dayTimesInMinutes = dayGrades.map((grade) => {
        return grade.timeTaken / 60; // Convert seconds to minutes
      });

      const dayAverageTimeInMinutes =
        dayTimesInMinutes.reduce((sum, time) => sum + time, 0) /
        dayTimesInMinutes.length;

      // Avoid division by zero
      if (dayAverageTimeInMinutes > 0) {
        dayEfficiency =
          Math.round((dayAverageScore / dayAverageTimeInMinutes) * 10) / 10;
      }
    }

    return {
      date: format(date, "MM/dd"),
      value: dayEfficiency,
      count: dayGrades.length,
    };
  });

  return {
    currentValue,
    trendData,
    hasData: trendData.some((day) => day.count > 0),
  };
};

/**
 * Calculate stagnation rate (percentage of profiles with minimal improvement)
 * @param attempts - All simulation attempts
 * @param chats - All simulation chats
 * @param grades - All simulation chat grades
 * @param simulations - All simulations
 * @param rubrics - All rubrics
 * @param dateStart - Start date for filtering
 * @param dateEnd - End date for filtering
 * @param profileId - Optional profile ID to filter by
 * @param cohorts - All cohorts for cohort filtering
 * @param cohortIds - Array of cohort IDs to filter by
 * @returns AnalyticsResult with stagnation rate and trend data
 */
export const calculateStagnationRate = (
  attempts: SimulationAttempt[],
  chats: SimulationChat[],
  grades: SimulationChatGrade[],
  simulations: Simulation[],
  rubrics: Rubric[],
  dateStart: Date,
  dateEnd: Date,
  profileId?: string,
  cohorts: Cohort[] = [],
  cohortIds: string[] = [],
  rolesAllowed?: ProfileRole[],
  showPractice: boolean = false,
  profiles?: { id: string; role: ProfileRole }[],
  showNormal: boolean = true
): AnalyticsResult => {
  const allowedSimulationIds = getAllowedSimulationIds(
    cohorts,
    cohortIds,
    profileId
  );

  // Filter attempts by date range and optionally include practice simulations
  const filteredAttempts = attempts.filter((attempt) => {
    const attemptDate = new Date(attempt.createdAt);
    const simulation = simulations.find((s) => s.id === attempt.simulationId);
    if (!(attemptDate >= dateStart && attemptDate <= dateEnd)) return false;
    if (!isIncludedByPractice(simulation, showPractice, showNormal))
      return false;
    if (rolesAllowed && rolesAllowed.length > 0 && profiles) {
      const prof = profiles.find((p) => p.id === attempt.profileId);
      if (!prof || !rolesAllowed.includes(prof.role)) return false;
    }
    return true;
  });

  // Filter by profileId if provided
  let profileFilteredAttempts = profileId
    ? filteredAttempts.filter((attempt) => attempt.profileId === profileId)
    : filteredAttempts;

  // Apply cohort filtering if simulation IDs are restricted
  if (allowedSimulationIds !== null) {
    if (allowedSimulationIds.length === 0) {
      return { currentValue: 0, trendData: [], hasData: false };
    }

    profileFilteredAttempts = profileFilteredAttempts.filter((attempt) =>
      allowedSimulationIds.includes(attempt.simulationId)
    );
  }

  if (profileFilteredAttempts.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Group attempts by profile and simulation
  const attemptsByProfileAndSimulation = new Map<
    string,
    typeof profileFilteredAttempts
  >();

  profileFilteredAttempts.forEach((attempt) => {
    const key = `${attempt.profileId}-${attempt.simulationId}`;
    if (!attemptsByProfileAndSimulation.has(key)) {
      attemptsByProfileAndSimulation.set(key, []);
    }
    attemptsByProfileAndSimulation.get(key)!.push(attempt);
  });

  // Calculate stagnation for each profile-simulation combination
  let stagnantProfiles = 0;
  let totalProfilesWithMultipleAttempts = 0;

  attemptsByProfileAndSimulation.forEach((profileAttempts) => {
    // Only consider profiles with 3+ attempts on the same simulation
    if (profileAttempts.length >= 3) {
      totalProfilesWithMultipleAttempts++;

      // Sort attempts by creation time
      const sortedAttempts = profileAttempts.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // Get first and last attempt scores
      const firstAttempt = sortedAttempts[0];
      const lastAttempt = sortedAttempts[sortedAttempts.length - 1];

      if (!firstAttempt || !lastAttempt) return;

      // Find grades for first and last attempts
      const firstAttemptChats = chats.filter(
        (chat) => chat.attemptId === firstAttempt.id
      );
      const lastAttemptChats = chats.filter(
        (chat) => chat.attemptId === lastAttempt.id
      );

      const firstAttemptGrades = grades.filter((grade) =>
        firstAttemptChats.some((chat) => chat.id === grade.simulationChatId)
      );
      const lastAttemptGrades = grades.filter((grade) =>
        lastAttemptChats.some((chat) => chat.id === grade.simulationChatId)
      );

      if (firstAttemptGrades.length > 0 && lastAttemptGrades.length > 0) {
        // Calculate average scores for first and last attempts
        const firstAttemptScores = firstAttemptGrades.map((grade) => {
          const chat = chats.find((c) => c.id === grade.simulationChatId);
          const attempt = attempts.find((a) => a.id === chat?.attemptId);
          const simulation = simulations.find(
            (s) => s.id === attempt?.simulationId
          );
          const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
          const rubricTotalPoints = rubric?.points || 100;
          return (grade.score / rubricTotalPoints) * 100;
        });

        const lastAttemptScores = lastAttemptGrades.map((grade) => {
          const chat = chats.find((c) => c.id === grade.simulationChatId);
          const attempt = attempts.find((a) => a.id === chat?.attemptId);
          const simulation = simulations.find(
            (s) => s.id === attempt?.simulationId
          );
          const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
          const rubricTotalPoints = rubric?.points || 100;
          return (grade.score / rubricTotalPoints) * 100;
        });

        const firstAttemptAvg =
          firstAttemptScores.reduce((sum, score) => sum + score, 0) /
          firstAttemptScores.length;
        const lastAttemptAvg =
          lastAttemptScores.reduce((sum, score) => sum + score, 0) /
          lastAttemptScores.length;

        // Calculate improvement percentage
        const improvement =
          ((lastAttemptAvg - firstAttemptAvg) / firstAttemptAvg) * 100;

        // Consider stagnant if improvement < 5%
        if (improvement < 5) {
          stagnantProfiles++;
        }
      }
    }
  });

  const currentValue =
    totalProfilesWithMultipleAttempts === 0
      ? 0
      : Math.round(
          (stagnantProfiles / totalProfilesWithMultipleAttempts) * 100
        );

  // Calculate trend data (simplified - just count attempts per day)
  const days = eachDayOfInterval({ start: dateStart, end: dateEnd });
  const trendData: AnalyticsDataPoint[] = days.map((date) => {
    const dateStr = format(date, "yyyy-MM-dd");

    const dayAttempts = profileFilteredAttempts.filter((attempt) => {
      const attemptDate = format(new Date(attempt.createdAt), "yyyy-MM-dd");
      return attemptDate === dateStr;
    });

    // Simplified stagnation rate for the day (heuristic)
    const dayStagnationRate =
      dayAttempts.length > 0
        ? Math.min(100, Math.round((dayAttempts.length / 10) * 100))
        : 0;

    return {
      date: format(date, "MM/dd"),
      value: dayStagnationRate,
      count: dayAttempts.length,
    };
  });

  return {
    currentValue,
    trendData,
    hasData: trendData.some((day) => day.count > 0),
  };
};

/**
 * Calculate total time spent in sessions
 * @param chats - All simulation chats
 * @param attempts - All simulation attempts
 * @param simulations - All simulations
 * @param dateStart - Start date for filtering
 * @param dateEnd - End date for filtering
 * @param profileId - Optional profile ID to filter by
 * @param cohorts - All cohorts for cohort filtering
 * @param cohortIds - Array of cohort IDs to filter by
 * @returns AnalyticsResult with total time spent and trend data
 */
export const calculateTimeSpent = (
  chats: SimulationChat[],
  attempts: SimulationAttempt[],
  simulations: Simulation[],
  dateStart: Date,
  dateEnd: Date,
  profileId?: string,
  cohorts: Cohort[] = [],
  cohortIds: string[] = [],
  rolesAllowed?: ProfileRole[],
  showPractice: boolean = false,
  profiles?: { id: string; role: ProfileRole }[],
  showNormal: boolean = true
): AnalyticsResult => {
  const allowedSimulationIds = getAllowedSimulationIds(
    cohorts,
    cohortIds,
    profileId
  );

  // Filter chats by date range
  const filteredChats = filterDataByDateAndProfile(chats, dateStart, dateEnd);

  // Filter by profileId if provided and exclude practice simulations
  const profileFilteredChats = profileId
    ? filteredChats.filter((chat) => {
        const attempt = attempts?.find((a) => a.id === chat.attemptId);
        return attempt?.profileId === profileId;
      })
    : filteredChats;

  // Filter out practice simulations unless showPractice is true
  let nonPracticeChats = profileFilteredChats.filter((chat) => {
    const attempt = attempts?.find((a) => a.id === chat.attemptId);
    const simulation = simulations?.find((s) => s.id === attempt?.simulationId);
    if (!isIncludedByPractice(simulation, showPractice, showNormal))
      return false;
    if (rolesAllowed && rolesAllowed.length > 0 && profiles) {
      const prof = profiles.find((p) => p.id === attempt?.profileId);
      if (!prof || !rolesAllowed.includes(prof.role)) return false;
    }
    return true;
  });

  // Apply cohort filtering if simulation IDs are restricted
  if (allowedSimulationIds !== null) {
    if (allowedSimulationIds.length === 0) {
      return { currentValue: 0, trendData: [], hasData: false };
    }

    nonPracticeChats = nonPracticeChats.filter((chat) => {
      const attempt = attempts?.find((a) => a.id === chat.attemptId);
      return allowedSimulationIds.includes(attempt?.simulationId || "");
    });
  }

  if (nonPracticeChats.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Calculate total time spent
  const totalTimeSpent = nonPracticeChats.reduce((sum, chat) => {
    if (chat.completedAt) {
      const timeSpent =
        (new Date(chat.completedAt).getTime() -
          new Date(chat.createdAt).getTime()) /
        1000; // seconds
      return sum + timeSpent;
    }
    return sum;
  }, 0);

  const currentValue = Math.round(totalTimeSpent);

  // Calculate trend data
  const days = eachDayOfInterval({ start: dateStart, end: dateEnd });
  const trendData: AnalyticsDataPoint[] = days.map((date) => {
    const dateStr = format(date, "yyyy-MM-dd");

    const dayChats = nonPracticeChats.filter((chat) => {
      const chatDate = format(new Date(chat.createdAt), "yyyy-MM-dd");
      return chatDate === dateStr;
    });

    const dayTimeSpent = dayChats.reduce((sum, chat) => {
      if (chat.completedAt) {
        const timeSpent =
          (new Date(chat.completedAt).getTime() -
            new Date(chat.createdAt).getTime()) /
          1000;
        return sum + timeSpent;
      }
      return sum;
    }, 0);

    return {
      date: format(date, "MM/dd"),
      value: Math.round(dayTimeSpent),
      count: dayChats.length,
    };
  });

  return {
    currentValue,
    trendData,
    hasData: trendData.some((day) => day.count > 0),
  };
};

/**
 * Calculate total attempts made
 * @param attempts - All simulation attempts
 * @param simulations - All simulations
 * @param dateStart - Start date for filtering
 * @param dateEnd - End date for filtering
 * @param profileId - Optional profile ID to filter by
 * @param cohorts - All cohorts for cohort filtering
 * @param cohortIds - Array of cohort IDs to filter by
 * @returns AnalyticsResult with total attempts and trend data
 */
export const calculateTotalAttempts = (
  attempts: SimulationAttempt[],
  simulations: Simulation[],
  dateStart: Date,
  dateEnd: Date,
  profileId?: string,
  cohorts: Cohort[] = [],
  cohortIds: string[] = [],
  rolesAllowed?: ProfileRole[],
  showPractice: boolean = false,
  profiles?: { id: string; role: ProfileRole }[],
  showNormal: boolean = true
): AnalyticsResult => {
  const allowedSimulationIds = getAllowedSimulationIds(
    cohorts,
    cohortIds,
    profileId
  );

  // Filter attempts by date range and optionally include practice simulations
  const filteredAttempts = attempts.filter((attempt) => {
    const attemptDate = new Date(attempt.createdAt);
    const simulation = simulations.find((s) => s.id === attempt.simulationId);
    if (!(attemptDate >= dateStart && attemptDate <= dateEnd)) return false;
    if (!isIncludedByPractice(simulation, showPractice, showNormal))
      return false;
    if (rolesAllowed && rolesAllowed.length > 0 && profiles) {
      const prof = profiles.find((p) => p.id === attempt.profileId);
      if (!prof || !rolesAllowed.includes(prof.role)) return false;
    }
    return true;
  });

  // Filter by profileId if provided
  let profileFilteredAttempts = profileId
    ? filteredAttempts.filter((attempt) => attempt.profileId === profileId)
    : filteredAttempts;

  // Apply cohort filtering if simulation IDs are restricted
  if (allowedSimulationIds !== null) {
    if (allowedSimulationIds.length === 0) {
      return { currentValue: 0, trendData: [], hasData: false };
    }

    profileFilteredAttempts = profileFilteredAttempts.filter((attempt) =>
      allowedSimulationIds.includes(attempt.simulationId)
    );
  }

  const currentValue = profileFilteredAttempts.length;

  // Calculate trend data
  const days = eachDayOfInterval({ start: dateStart, end: dateEnd });
  const trendData: AnalyticsDataPoint[] = days.map((date) => {
    const dateStr = format(date, "yyyy-MM-dd");

    const dayAttempts = profileFilteredAttempts.filter((attempt) => {
      const attemptDate = format(new Date(attempt.createdAt), "yyyy-MM-dd");
      return attemptDate === dateStr;
    });

    return {
      date: format(date, "MM/dd"),
      value: dayAttempts.length,
      count: dayAttempts.length,
    };
  });

  return {
    currentValue,
    trendData,
    hasData: trendData.some((day) => day.count > 0),
  };
};
