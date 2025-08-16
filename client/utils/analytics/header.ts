import type {
  Rubric,
  SimulationAttempt,
  SimulationChat,
  SimulationChatGrade,
  SimulationMessage,
} from "@/types";
import type { FilteredData } from "@/utils/analytics/filtering";
import { format } from "date-fns";

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

/**
 * Calculate average score across all simulation attempts
 * @param filteredData - Pre-filtered analytics data
 * @param rubrics - All rubrics for score calculation
 * @returns AnalyticsResult with average score and trend data
 */
export const calculateAverageScore = (
  filteredData: FilteredData,
  rubrics: Rubric[]
): AnalyticsResult => {
  if (filteredData.grades.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Calculate average score using rubric points
  const scoreSum = filteredData.grades.reduce((sum, grade) => {
    const chat = filteredData.chats.find(
      (c) => c.id === grade.simulationChatId
    );
    const attempt = filteredData.attempts.find((a) => a.id === chat?.attemptId);
    const simulation = filteredData.simulations.find(
      (s) => s.id === attempt?.simulationId
    );
    const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
    const rubricTotalPoints = rubric?.points || 100;
    const scorePercent = Math.round((grade.score / rubricTotalPoints) * 100);
    return sum + scorePercent;
  }, 0);

  const currentValue = Math.round(scoreSum / filteredData.grades.length);

  // Calculate trend data by grouping grades by date
  const gradesByDate = new Map<string, SimulationChatGrade[]>();

  filteredData.grades.forEach((grade) => {
    const dateStr = format(new Date(grade.createdAt), "yyyy-MM-dd");
    if (!gradesByDate.has(dateStr)) {
      gradesByDate.set(dateStr, []);
    }
    gradesByDate.get(dateStr)!.push(grade);
  });

  const trendData: AnalyticsDataPoint[] = Array.from(gradesByDate.entries())
    .map(([dateStr, dayGrades]) => {
      const dayScoreSum = dayGrades.reduce((sum, grade) => {
        const chat = filteredData.chats.find(
          (c) => c.id === grade.simulationChatId
        );
        const attempt = filteredData.attempts.find(
          (a) => a.id === chat?.attemptId
        );
        const simulation = filteredData.simulations.find(
          (s) => s.id === attempt?.simulationId
        );
        const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
        const rubricTotalPoints = rubric?.points || 100;
        const scorePercent = Math.round(
          (grade.score / rubricTotalPoints) * 100
        );
        return sum + scorePercent;
      }, 0);

      const avgScore = Math.round(dayScoreSum / dayGrades.length);

      return {
        date: format(new Date(dateStr), "MM/dd"),
        value: avgScore,
        count: dayGrades.length,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    currentValue,
    trendData,
    hasData: trendData.some((day) => day.count > 0),
  };
};

/**
 * Calculate completion percentage (percentage of chats that passed)
 * @param filteredData - Pre-filtered analytics data
 * @returns AnalyticsResult with completion percentage and trend data
 */
export const calculateCompletionPercentage = (
  filteredData: FilteredData
): AnalyticsResult => {
  if (filteredData.chats.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Count chats with passing grades
  const passingChats = filteredData.chats.filter((chat) => {
    const chatGrade = filteredData.grades.find(
      (grade) => grade.simulationChatId === chat.id
    );
    return chatGrade?.passed === true;
  });

  const currentValue = Math.round(
    (passingChats.length / filteredData.chats.length) * 100
  );

  // Calculate trend data by grouping chats by date
  const chatsByDate = new Map<string, SimulationChat[]>();

  filteredData.chats.forEach((chat) => {
    const dateStr = format(new Date(chat.createdAt), "yyyy-MM-dd");
    if (!chatsByDate.has(dateStr)) {
      chatsByDate.set(dateStr, []);
    }
    chatsByDate.get(dateStr)!.push(chat);
  });

  const trendData: AnalyticsDataPoint[] = Array.from(chatsByDate.entries())
    .map(([dateStr, dayChats]) => {
      const passingDayChats = dayChats.filter((chat) => {
        const chatGrade = filteredData.grades.find(
          (grade) => grade.simulationChatId === chat.id
        );
        return chatGrade?.passed === true;
      });

      const completionRate = Math.round(
        (passingDayChats.length / dayChats.length) * 100
      );

      return {
        date: format(new Date(dateStr), "MM/dd"),
        value: completionRate,
        count: dayChats.length,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    currentValue,
    trendData,
    hasData: trendData.some((day) => day.count > 0),
  };
};

/**
 * Calculate first attempt pass rate (percentage of first attempts that passed)
 * @param filteredData - Pre-filtered analytics data
 * @returns AnalyticsResult with first attempt pass rate and trend data
 */
export const calculateFirstAttemptPassRate = (
  filteredData: FilteredData
): AnalyticsResult => {
  if (filteredData.attempts.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Group attempts by profileId + simulationId to find first attempts
  const firstAttempts = filteredData.attempts.reduce(
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
    const attemptChats = filteredData.chats.filter(
      (chat) => chat.attemptId === attempt.id
    );
    return attemptChats.some((chat) => {
      const chatGrade = filteredData.grades.find(
        (grade) => grade.simulationChatId === chat.id
      );
      return chatGrade?.passed === true;
    });
  });

  const currentValue = Math.round(
    (passedFirstAttempts.length / firstAttemptsList.length) * 100
  );

  // Calculate trend data by grouping attempts by date
  const attemptsByDate = new Map<string, SimulationAttempt[]>();

  filteredData.attempts.forEach((attempt) => {
    const dateStr = format(new Date(attempt.createdAt), "yyyy-MM-dd");
    if (!attemptsByDate.has(dateStr)) {
      attemptsByDate.set(dateStr, []);
    }
    attemptsByDate.get(dateStr)!.push(attempt);
  });

  const trendData: AnalyticsDataPoint[] = Array.from(attemptsByDate.entries())
    .map(([dateStr, dayAttempts]) => {
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

      const passedDayFirstAttempts = dayFirstAttemptsList.filter((attempt) => {
        const attemptChats = filteredData.chats.filter(
          (chat) => chat.attemptId === attempt.id
        );
        return attemptChats.some((chat) => {
          const chatGrade = filteredData.grades.find(
            (grade) => grade.simulationChatId === chat.id
          );
          return chatGrade?.passed === true;
        });
      });

      const passRate = Math.round(
        (passedDayFirstAttempts.length / dayFirstAttemptsList.length) * 100
      );

      return {
        date: format(new Date(dateStr), "MM/dd"),
        value: passRate,
        count: dayFirstAttemptsList.length,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    currentValue,
    trendData,
    hasData: trendData.some((day) => day.count > 0),
  };
};

/**
 * Calculate highest score achieved
 * @param filteredData - Pre-filtered analytics data
 * @param rubrics - All rubrics for score calculation
 * @returns AnalyticsResult with highest score and trend data
 */
export const calculateHighestScore = (
  filteredData: FilteredData,
  rubrics: Rubric[]
): AnalyticsResult => {
  if (filteredData.grades.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Calculate highest score using rubric points
  const highestScore = Math.max(
    ...filteredData.grades.map((grade) => {
      const chat = filteredData.chats.find(
        (c) => c.id === grade.simulationChatId
      );
      const attempt = filteredData.attempts.find(
        (a) => a.id === chat?.attemptId
      );
      const simulation = filteredData.simulations.find(
        (s) => s.id === attempt?.simulationId
      );
      const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
      const rubricTotalPoints = rubric?.points || 100;
      return Math.round((grade.score / rubricTotalPoints) * 100);
    })
  );

  // Calculate trend data by grouping grades by date
  const gradesByDate = new Map<string, SimulationChatGrade[]>();

  filteredData.grades.forEach((grade) => {
    const dateStr = format(new Date(grade.createdAt), "yyyy-MM-dd");
    if (!gradesByDate.has(dateStr)) {
      gradesByDate.set(dateStr, []);
    }
    gradesByDate.get(dateStr)!.push(grade);
  });

  const trendData: AnalyticsDataPoint[] = Array.from(gradesByDate.entries())
    .map(([dateStr, dayGrades]) => {
      const dayHighestScore = Math.max(
        ...dayGrades.map((grade) => {
          const chat = filteredData.chats.find(
            (c) => c.id === grade.simulationChatId
          );
          const attempt = filteredData.attempts.find(
            (a) => a.id === chat?.attemptId
          );
          const simulation = filteredData.simulations.find(
            (s) => s.id === attempt?.simulationId
          );
          const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
          const rubricTotalPoints = rubric?.points || 100;
          return Math.round((grade.score / rubricTotalPoints) * 100);
        })
      );

      return {
        date: format(new Date(dateStr), "MM/dd"),
        value: dayHighestScore,
        count: dayGrades.length,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    currentValue: highestScore,
    trendData,
    hasData: trendData.some((day) => day.count > 0),
  };
};

/**
 * Calculate a single user's highest attempt average and pass status for a given simulation
 * Returns percentage score for UI and boolean passed using rubric passPoints.
 */
export function calculateUserSimulationPerformance(
  filteredData: FilteredData,
  rubrics: Rubric[],
  profileId: string,
  simulationId: string
): { highestScorePercent: number; passed: boolean } {
  if (!profileId) return { highestScorePercent: 0, passed: false };

  const rubric = (() => {
    const sim = filteredData.simulations.find((s) => s.id === simulationId);
    return rubrics.find((r) => r.id === sim?.rubricId);
  })();

  const profileAttempts = filteredData.attempts.filter(
    (attempt) =>
      attempt.profileId === profileId && attempt.simulationId === simulationId
  );
  if (profileAttempts.length === 0) {
    return { highestScorePercent: 0, passed: false };
  }

  // Average raw points per attempt across its graded chats
  const attemptAverages: number[] = profileAttempts.map((attempt) => {
    const attemptChats = filteredData.chats.filter(
      (chat) => chat.attemptId === attempt.id
    );
    const chatGrades = attemptChats
      .map((chat) =>
        filteredData.grades.find((g) => g.simulationChatId === chat.id)
      )
      .filter(Boolean) as SimulationChatGrade[];
    if (chatGrades.length === 0) return 0;
    const totalScore = chatGrades.reduce((sum, g) => sum + g.score, 0);
    return totalScore / chatGrades.length; // raw points average
  });

  const highestRawAverage = Math.max(...attemptAverages);
  const rubricPoints = rubric?.points || 100;
  const passPoints = rubric?.passPoints ?? 70; // fallback if missing
  const highestScorePercent = Math.round(
    (highestRawAverage / rubricPoints) * 100
  );
  const passed = highestRawAverage >= passPoints;

  return { highestScorePercent, passed };
}

/**
 * Bulk compute a single user's performance for all simulations in the filtered set.
 * Returns a map of simulationId -> { highestScorePercent, passed }.
 */
export function calculateUserPerformanceBySimulation(
  filteredData: FilteredData,
  rubrics: Rubric[],
  profileId: string
): Record<string, { highestScorePercent: number; passed: boolean }> {
  const result: Record<
    string,
    { highestScorePercent: number; passed: boolean }
  > = {};
  if (!profileId) return result;

  // Group attempts by simulation for this profile
  const attemptsBySimulation = new Map<string, SimulationAttempt[]>();
  filteredData.attempts.forEach((attempt) => {
    if (attempt.profileId !== profileId) return;
    const arr = attemptsBySimulation.get(attempt.simulationId) ?? [];
    arr.push(attempt);
    attemptsBySimulation.set(attempt.simulationId, arr);
  });

  attemptsBySimulation.forEach((_attempts, simulationId) => {
    result[simulationId] = calculateUserSimulationPerformance(
      filteredData,
      rubrics,
      profileId,
      simulationId
    );
  });

  return result;
}

/**
 * Calculate average messages per session
 * @param messages - All simulation messages
 * @param filteredData - Pre-filtered analytics data
 * @returns AnalyticsResult with average messages per session and trend data
 */
export const calculateMessagesPerSession = (
  messages: SimulationMessage[],
  filteredData: FilteredData
): AnalyticsResult => {
  if (filteredData.chats.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Calculate messages per session
  const totalMessages = filteredData.chats.reduce((sum, chat) => {
    const chatMessages = messages.filter((msg) => msg.chatId === chat.id);
    return sum + chatMessages.length;
  }, 0);

  const currentValue = Math.round(totalMessages / filteredData.chats.length);

  // Calculate trend data by grouping chats by date
  const chatsByDate = new Map<string, SimulationChat[]>();

  filteredData.chats.forEach((chat) => {
    const dateStr = format(new Date(chat.createdAt), "yyyy-MM-dd");
    if (!chatsByDate.has(dateStr)) {
      chatsByDate.set(dateStr, []);
    }
    chatsByDate.get(dateStr)!.push(chat);
  });

  const trendData: AnalyticsDataPoint[] = Array.from(chatsByDate.entries())
    .map(([dateStr, dayChats]) => {
      const dayTotalMessages = dayChats.reduce((sum, chat) => {
        const chatMessages = messages.filter((msg) => msg.chatId === chat.id);
        return sum + chatMessages.length;
      }, 0);

      const avgMessages = Math.round(dayTotalMessages / dayChats.length);

      return {
        date: format(new Date(dateStr), "MM/dd"),
        value: avgMessages,
        count: dayChats.length,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    currentValue,
    trendData,
    hasData: trendData.some((day) => day.count > 0),
  };
};

/**
 * Calculate average persona response times
 * @param messages - All simulation messages
 * @param filteredData - Pre-filtered analytics data
 * @returns AnalyticsResult with average response time and trend data
 */
export const calculatePersonaResponseTimes = (
  messages: SimulationMessage[],
  filteredData: FilteredData
): AnalyticsResult => {
  if (filteredData.chats.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Calculate response times
  const responseTimes: number[] = [];
  filteredData.chats.forEach((chat) => {
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

  // Calculate trend data by grouping chats by date
  const chatsByDate = new Map<string, SimulationChat[]>();

  filteredData.chats.forEach((chat) => {
    const dateStr = format(new Date(chat.createdAt), "yyyy-MM-dd");
    if (!chatsByDate.has(dateStr)) {
      chatsByDate.set(dateStr, []);
    }
    chatsByDate.get(dateStr)!.push(chat);
  });

  const trendData: AnalyticsDataPoint[] = Array.from(chatsByDate.entries())
    .map(([dateStr, dayChats]) => {
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
        date: format(new Date(dateStr), "MM/dd"),
        value: avgResponseTime,
        count: dayChats.length,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    currentValue,
    trendData,
    hasData: trendData.some((day) => day.count > 0),
  };
};

/**
 * Calculate session efficiency (average score / average time per session)
 * @param filteredData - Pre-filtered analytics data
 * @param rubrics - All rubrics for score calculation
 * @returns AnalyticsResult with session efficiency and trend data
 */
export const calculateSessionEfficiency = (
  filteredData: FilteredData,
  rubrics: Rubric[]
): AnalyticsResult => {
  if (filteredData.grades.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Calculate average score percentage
  const scores = filteredData.grades.map((grade) => {
    const chat = filteredData.chats.find(
      (c) => c.id === grade.simulationChatId
    );
    const attempt = filteredData.attempts.find((a) => a.id === chat?.attemptId);
    const simulation = filteredData.simulations.find(
      (s) => s.id === attempt?.simulationId
    );
    const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
    const rubricTotalPoints = rubric?.points || 100;
    return Math.round((grade.score / rubricTotalPoints) * 100);
  });

  const averageScore =
    scores.reduce((sum, score) => sum + score, 0) / scores.length;

  // Calculate average time per session in minutes
  const timesInMinutes = filteredData.grades.map((grade) => {
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

  // Calculate trend data by grouping grades by date
  const gradesByDate = new Map<string, SimulationChatGrade[]>();

  filteredData.grades.forEach((grade) => {
    const dateStr = format(new Date(grade.createdAt), "yyyy-MM-dd");
    if (!gradesByDate.has(dateStr)) {
      gradesByDate.set(dateStr, []);
    }
    gradesByDate.get(dateStr)!.push(grade);
  });

  const trendData: AnalyticsDataPoint[] = Array.from(gradesByDate.entries())
    .map(([dateStr, dayGrades]) => {
      // Calculate average score percentage for the day
      const dayScores = dayGrades.map((grade) => {
        const chat = filteredData.chats.find(
          (c) => c.id === grade.simulationChatId
        );
        const attempt = filteredData.attempts.find(
          (a) => a.id === chat?.attemptId
        );
        const simulation = filteredData.simulations.find(
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
      let dayEfficiency = 0;
      if (dayAverageTimeInMinutes > 0) {
        dayEfficiency =
          Math.round((dayAverageScore / dayAverageTimeInMinutes) * 10) / 10;
      }

      return {
        date: format(new Date(dateStr), "MM/dd"),
        value: dayEfficiency,
        count: dayGrades.length,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    currentValue,
    trendData,
    hasData: trendData.some((day) => day.count > 0),
  };
};

/**
 * Calculate stagnation rate (percentage of profiles with minimal improvement)
 * @param filteredData - Pre-filtered analytics data
 * @param rubrics - All rubrics for score calculation
 * @returns AnalyticsResult with stagnation rate and trend data
 */
export const calculateStagnationRate = (
  filteredData: FilteredData,
  rubrics: Rubric[]
): AnalyticsResult => {
  if (filteredData.attempts.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Group attempts by profile and simulation
  const attemptsByProfileAndSimulation = new Map<string, SimulationAttempt[]>();

  filteredData.attempts.forEach((attempt) => {
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
      const firstAttemptChats = filteredData.chats.filter(
        (chat) => chat.attemptId === firstAttempt.id
      );
      const lastAttemptChats = filteredData.chats.filter(
        (chat) => chat.attemptId === lastAttempt.id
      );

      const firstAttemptGrades = filteredData.grades.filter((grade) =>
        firstAttemptChats.some((chat) => chat.id === grade.simulationChatId)
      );
      const lastAttemptGrades = filteredData.grades.filter((grade) =>
        lastAttemptChats.some((chat) => chat.id === grade.simulationChatId)
      );

      if (firstAttemptGrades.length > 0 && lastAttemptGrades.length > 0) {
        // Calculate average scores for first and last attempts
        const firstAttemptScores = firstAttemptGrades.map((grade) => {
          const chat = filteredData.chats.find(
            (c) => c.id === grade.simulationChatId
          );
          const attempt = filteredData.attempts.find(
            (a) => a.id === chat?.attemptId
          );
          const simulation = filteredData.simulations.find(
            (s) => s.id === attempt?.simulationId
          );
          const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
          const rubricTotalPoints = rubric?.points || 100;
          return (grade.score / rubricTotalPoints) * 100;
        });

        const lastAttemptScores = lastAttemptGrades.map((grade) => {
          const chat = filteredData.chats.find(
            (c) => c.id === grade.simulationChatId
          );
          const attempt = filteredData.attempts.find(
            (a) => a.id === chat?.attemptId
          );
          const simulation = filteredData.simulations.find(
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

  // Calculate trend data by grouping attempts by date
  const attemptsByDate = new Map<string, SimulationAttempt[]>();

  filteredData.attempts.forEach((attempt) => {
    const dateStr = format(new Date(attempt.createdAt), "yyyy-MM-dd");
    if (!attemptsByDate.has(dateStr)) {
      attemptsByDate.set(dateStr, []);
    }
    attemptsByDate.get(dateStr)!.push(attempt);
  });

  const trendData: AnalyticsDataPoint[] = Array.from(attemptsByDate.entries())
    .map(([dateStr, dayAttempts]) => {
      // Simplified stagnation rate for the day (heuristic)
      const dayStagnationRate =
        dayAttempts.length > 0
          ? Math.min(100, Math.round((dayAttempts.length / 10) * 100))
          : 0;

      return {
        date: format(new Date(dateStr), "MM/dd"),
        value: dayStagnationRate,
        count: dayAttempts.length,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    currentValue,
    trendData,
    hasData: trendData.some((day) => day.count > 0),
  };
};

/**
 * Calculate total time spent in sessions
 * @param filteredData - Pre-filtered analytics data
 * @returns AnalyticsResult with total time spent and trend data
 */
export const calculateTimeSpent = (
  filteredData: FilteredData
): AnalyticsResult => {
  if (filteredData.chats.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Calculate total time spent
  const totalTimeSpent = filteredData.chats.reduce((sum, chat) => {
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

  // Calculate trend data by grouping chats by date
  const chatsByDate = new Map<string, SimulationChat[]>();

  filteredData.chats.forEach((chat) => {
    const dateStr = format(new Date(chat.createdAt), "yyyy-MM-dd");
    if (!chatsByDate.has(dateStr)) {
      chatsByDate.set(dateStr, []);
    }
    chatsByDate.get(dateStr)!.push(chat);
  });

  const trendData: AnalyticsDataPoint[] = Array.from(chatsByDate.entries())
    .map(([dateStr, dayChats]) => {
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
        date: format(new Date(dateStr), "MM/dd"),
        value: Math.round(dayTimeSpent),
        count: dayChats.length,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    currentValue,
    trendData,
    hasData: trendData.some((day) => day.count > 0),
  };
};

/**
 * Calculate total attempts made
 * @param filteredData - Pre-filtered analytics data
 * @returns AnalyticsResult with total attempts and trend data
 */
export const calculateTotalAttempts = (
  filteredData: FilteredData
): AnalyticsResult => {
  if (filteredData.attempts.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  const currentValue = filteredData.attempts.length;

  // Calculate trend data by grouping attempts by date
  const attemptsByDate = new Map<string, SimulationAttempt[]>();

  filteredData.attempts.forEach((attempt) => {
    const dateStr = format(new Date(attempt.createdAt), "yyyy-MM-dd");
    if (!attemptsByDate.has(dateStr)) {
      attemptsByDate.set(dateStr, []);
    }
    attemptsByDate.get(dateStr)!.push(attempt);
  });

  const trendData: AnalyticsDataPoint[] = Array.from(attemptsByDate.entries())
    .map(([dateStr, dayAttempts]) => {
      return {
        date: format(new Date(dateStr), "MM/dd"),
        value: dayAttempts.length,
        count: dayAttempts.length,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    currentValue,
    trendData,
    hasData: trendData.some((day) => day.count > 0),
  };
};
