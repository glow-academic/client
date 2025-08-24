import type {
  Rubric,
  SimulationAttempt,
  SimulationChat,
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
 * Calculate average score across all simulation attempts (matching server logic)
 * @param filteredData - Pre-filtered analytics data
 * @param rubrics - All rubrics for score calculation
 * @returns AnalyticsResult with average score and trend data
 */
export const calculateAverageScore = (
  filteredData: FilteredData,
  rubrics: Rubric[]
): AnalyticsResult => {
  if (filteredData.attempts.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Calculate attempt-level scores (matching server logic)
  const attemptScores: number[] = [];

  filteredData.attempts.forEach((attempt) => {
    const attemptChats = filteredData.chats.filter(
      (chat) => chat.attemptId === attempt.id
    );

    // Get simulation to find total expected chats
    const simulation = filteredData.simulations.find(
      (s) => s.id === attempt.simulationId
    );
    const totalExpected =
      simulation?.scenarioIds?.length || attemptChats.length || 0;

    if (totalExpected === 0) {
      return;
    }

    // Count completed chats
    const completedChats = attemptChats.filter((chat) => chat.completed);

    // If no chats are completed, skip this attempt
    if (completedChats.length === 0) {
      return;
    }

    // Calculate total score including zeros for ALL expected chats
    let totalScore = 0;

    // For each expected chat, find if it exists and has a grade
    for (let i = 0; i < totalExpected; i++) {
      const expectedChat = attemptChats[i];
      if (expectedChat && expectedChat.completed) {
        const grade = filteredData.grades.find(
          (g) => g.simulationChatId === expectedChat.id
        );
        totalScore += grade?.score || 0;
      }
      // If chat doesn't exist or is not completed, add 0 (implicit)
    }

    // Calculate average score for this attempt
    const attemptAvgScore = totalScore / totalExpected;

    // Normalize by rubric points
    if (attemptChats.length > 0) {
      const firstChat = attemptChats[0];
      if (firstChat) {
        const grade = filteredData.grades.find(
          (g) => g.simulationChatId === firstChat.id
        );
        if (grade) {
          const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
          const rubricPoints = rubric?.points || 100;
          const normalizedAttemptScore =
            (attemptAvgScore / Math.max(rubricPoints, 1)) * 100;
          attemptScores.push(normalizedAttemptScore);
        }
      }
    }
  });

  const currentValue =
    attemptScores.length > 0
      ? Math.round(
          attemptScores.reduce((sum, score) => sum + score, 0) /
            attemptScores.length
        )
      : 0;

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
      const dayAttemptScores: number[] = [];

      dayAttempts.forEach((attempt) => {
        const attemptChats = filteredData.chats.filter(
          (chat) => chat.attemptId === attempt.id
        );

        const simulation = filteredData.simulations.find(
          (s) => s.id === attempt.simulationId
        );
        const totalExpected =
          simulation?.scenarioIds?.length || attemptChats.length || 0;

        if (totalExpected === 0) {
          return;
        }

        const completedChats = attemptChats.filter((chat) => chat.completed);

        if (completedChats.length === 0) {
          return;
        }

        let totalScore = 0;

        for (let i = 0; i < totalExpected; i++) {
          const expectedChat = attemptChats[i];
          if (expectedChat && expectedChat.completed) {
            const grade = filteredData.grades.find(
              (g) => g.simulationChatId === expectedChat.id
            );
            totalScore += grade?.score || 0;
          }
        }

        const attemptAvgScore = totalScore / totalExpected;

        if (attemptChats.length > 0) {
          const firstChat = attemptChats[0];
          if (firstChat) {
            const grade = filteredData.grades.find(
              (g) => g.simulationChatId === firstChat.id
            );
            if (grade) {
              const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
              const rubricPoints = rubric?.points || 100;
              const normalizedAttemptScore =
                (attemptAvgScore / Math.max(rubricPoints, 1)) * 100;
              dayAttemptScores.push(normalizedAttemptScore);
            }
          }
        }
      });

      const avgScore =
        dayAttemptScores.length > 0
          ? Math.round(
              dayAttemptScores.reduce((sum, score) => sum + score, 0) /
                dayAttemptScores.length
            )
          : 0;

      return {
        date: format(new Date(dateStr), "MM/dd"),
        value: avgScore,
        count: dayAttempts.length,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    currentValue,
    trendData,
    // Trend data is intentionally empty; base it on actual data presence
    hasData: attemptScores.length > 0 || filteredData.chats.length > 0,
  };
};

/**
 * Calculate completion percentage (matching server logic)
 * @param filteredData - Pre-filtered analytics data
 * @returns AnalyticsResult with completion percentage and trend data
 */
export const calculateCompletionPercentage = (
  filteredData: FilteredData
): AnalyticsResult => {
  if (filteredData.chats.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Completion percentage: percentage of chats that are completed
  const completedSessions = filteredData.chats.filter(
    (chat) => chat.completed
  ).length;
  const totalSessions = filteredData.chats.length;
  const currentValue = Math.round((completedSessions / totalSessions) * 100);

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
 * Calculate highest score achieved (matching server logic)
 * @param filteredData - Pre-filtered analytics data
 * @param rubrics - All rubrics for score calculation
 * @returns AnalyticsResult with highest score and trend data
 */
export const calculateHighestScore = (
  filteredData: FilteredData,
  rubrics: Rubric[]
): AnalyticsResult => {
  if (filteredData.attempts.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Calculate attempt-level scores (matching server logic)
  const attemptScores: number[] = [];

  filteredData.attempts.forEach((attempt) => {
    const attemptChats = filteredData.chats.filter(
      (chat) => chat.attemptId === attempt.id
    );

    // Get simulation to find total expected chats
    const simulation = filteredData.simulations.find(
      (s) => s.id === attempt.simulationId
    );
    const totalExpected =
      simulation?.scenarioIds?.length || attemptChats.length || 0;

    if (totalExpected === 0) {
      return;
    }

    // Count completed chats
    const completedChats = attemptChats.filter((chat) => chat.completed);

    // If no chats are completed, skip this attempt
    if (completedChats.length === 0) {
      return;
    }

    // Calculate total score including zeros for ALL expected chats
    let totalScore = 0;

    // For each expected chat, find if it exists and has a grade
    for (let i = 0; i < totalExpected; i++) {
      const expectedChat = attemptChats[i];
      if (expectedChat && expectedChat.completed) {
        const grade = filteredData.grades.find(
          (g) => g.simulationChatId === expectedChat.id
        );
        totalScore += grade?.score || 0;
      }
      // If chat doesn't exist or is not completed, add 0 (implicit)
    }

    // Calculate average score for this attempt
    const attemptAvgScore = totalScore / totalExpected;

    // Normalize by rubric points
    if (attemptChats.length > 0) {
      const firstChat = attemptChats[0];
      if (firstChat) {
        const grade = filteredData.grades.find(
          (g) => g.simulationChatId === firstChat.id
        );
        if (grade) {
          const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
          const rubricPoints = rubric?.points || 100;
          const normalizedAttemptScore =
            (attemptAvgScore / Math.max(rubricPoints, 1)) * 100;
          attemptScores.push(normalizedAttemptScore);
        }
      }
    }
  });

  const currentValue =
    attemptScores.length > 0 ? Math.round(Math.max(...attemptScores)) : 0;

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
      const dayAttemptScores: number[] = [];

      dayAttempts.forEach((attempt) => {
        const attemptChats = filteredData.chats.filter(
          (chat) => chat.attemptId === attempt.id
        );

        const simulation = filteredData.simulations.find(
          (s) => s.id === attempt.simulationId
        );
        const totalExpected =
          simulation?.scenarioIds?.length || attemptChats.length || 0;

        if (totalExpected === 0) {
          return;
        }

        const completedChats = attemptChats.filter((chat) => chat.completed);

        if (completedChats.length === 0) {
          return;
        }

        let totalScore = 0;

        for (let i = 0; i < totalExpected; i++) {
          const expectedChat = attemptChats[i];
          if (expectedChat && expectedChat.completed) {
            const grade = filteredData.grades.find(
              (g) => g.simulationChatId === expectedChat.id
            );
            totalScore += grade?.score || 0;
          }
        }

        const attemptAvgScore = totalScore / totalExpected;

        if (attemptChats.length > 0) {
          const firstChat = attemptChats[0];
          if (firstChat) {
            const grade = filteredData.grades.find(
              (g) => g.simulationChatId === firstChat.id
            );
            if (grade) {
              const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
              const rubricPoints = rubric?.points || 100;
              const normalizedAttemptScore =
                (attemptAvgScore / Math.max(rubricPoints, 1)) * 100;
              dayAttemptScores.push(normalizedAttemptScore);
            }
          }
        }
      });

      const dayHighestScore =
        dayAttemptScores.length > 0
          ? Math.round(Math.max(...dayAttemptScores))
          : 0;

      return {
        date: format(new Date(dateStr), "MM/dd"),
        value: dayHighestScore,
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

  // Calculate attempt averages using the same logic as other components
  const attemptAverages: number[] = profileAttempts.map((attempt) => {
    const attemptChats = filteredData.chats.filter(
      (chat) => chat.attemptId === attempt.id
    );

    // Get simulation to find total expected chats
    const simulation = filteredData.simulations.find(
      (s) => s.id === simulationId
    );
    const totalExpected =
      simulation?.scenarioIds?.length || attemptChats.length || 0;

    if (totalExpected === 0) {
      return 0;
    }

    // Count completed chats
    const completedChats = attemptChats.filter((chat) => chat.completed);

    // If no chats are completed, return 0
    if (completedChats.length === 0) {
      return 0;
    }

    // Calculate total score including zeros for ALL expected chats
    let totalScore = 0;

    // For each expected chat, find if it exists and has a grade
    for (let i = 0; i < totalExpected; i++) {
      const expectedChat = attemptChats[i];
      if (expectedChat && expectedChat.completed) {
        const grade = filteredData.grades.find(
          (g) => g.simulationChatId === expectedChat.id
        );
        totalScore += grade?.score || 0;
      }
      // If chat doesn't exist or is not completed, add 0 (implicit)
    }

    return totalScore / totalExpected; // raw points average
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
 * Calculate average user response times (matching server logic)
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

  // Calculate user response times (response->query pairs)
  const userResponseTimes: number[] = [];
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

      // Look for response -> query pairs (persona response followed by user query)
      if (
        currentMessage &&
        previousMessage &&
        previousMessage.type === "response" &&
        currentMessage.type === "query"
      ) {
        const responseTime =
          new Date(currentMessage.createdAt).getTime() -
          new Date(previousMessage.createdAt).getTime();
        const responseTimeSeconds = responseTime / 1000;

        // Only include reasonable response times (between 1 second and 1 hour)
        if (responseTimeSeconds >= 1.0 && responseTimeSeconds <= 3600.0) {
          userResponseTimes.push(responseTimeSeconds);
        }
      }
    }
  });

  const currentValue =
    userResponseTimes.length > 0
      ? Math.round(
          userResponseTimes.reduce((sum, time) => sum + time, 0) /
            userResponseTimes.length
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
      const dayUserResponseTimes: number[] = [];
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

          // Look for response -> query pairs (persona response followed by user query)
          if (
            currentMessage &&
            previousMessage &&
            previousMessage.type === "response" &&
            currentMessage.type === "query"
          ) {
            const responseTime =
              new Date(currentMessage.createdAt).getTime() -
              new Date(previousMessage.createdAt).getTime();
            const responseTimeSeconds = responseTime / 1000;

            // Only include reasonable response times (between 1 second and 1 hour)
            if (responseTimeSeconds >= 1.0 && responseTimeSeconds <= 3600.0) {
              dayUserResponseTimes.push(responseTimeSeconds);
            }
          }
        }
      });

      const avgResponseTime =
        dayUserResponseTimes.length > 0
          ? Math.round(
              dayUserResponseTimes.reduce((sum, time) => sum + time, 0) /
                dayUserResponseTimes.length
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
 * Calculate session efficiency (matching server logic)
 * @param filteredData - Pre-filtered analytics data
 * @param rubrics - All rubrics for score calculation
 * @returns AnalyticsResult with session efficiency and trend data
 */
export const calculateSessionEfficiency = (
  filteredData: FilteredData,
  rubrics: Rubric[]
): AnalyticsResult => {
  if (filteredData.attempts.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Calculate attempt-level scores (matching server logic)
  const attemptScores: number[] = [];

  filteredData.attempts.forEach((attempt) => {
    const attemptChats = filteredData.chats.filter(
      (chat) => chat.attemptId === attempt.id
    );

    // Get simulation to find total expected chats
    const simulation = filteredData.simulations.find(
      (s) => s.id === attempt.simulationId
    );
    const totalExpected =
      simulation?.scenarioIds?.length || attemptChats.length || 0;

    if (totalExpected === 0) {
      return;
    }

    // Count completed chats
    const completedChats = attemptChats.filter((chat) => chat.completed);

    // If no chats are completed, skip this attempt
    if (completedChats.length === 0) {
      return;
    }

    // Calculate total score including zeros for ALL expected chats
    let totalScore = 0;

    // For each expected chat, find if it exists and has a grade
    for (let i = 0; i < totalExpected; i++) {
      const expectedChat = attemptChats[i];
      if (expectedChat && expectedChat.completed) {
        const grade = filteredData.grades.find(
          (g) => g.simulationChatId === expectedChat.id
        );
        totalScore += grade?.score || 0;
      }
      // If chat doesn't exist or is not completed, add 0 (implicit)
    }

    // Calculate average score for this attempt
    const attemptAvgScore = totalScore / totalExpected;

    // Normalize by rubric points
    if (attemptChats.length > 0) {
      const firstChat = attemptChats[0];
      if (firstChat) {
        const grade = filteredData.grades.find(
          (g) => g.simulationChatId === firstChat.id
        );
        if (grade) {
          const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
          const rubricPoints = rubric?.points || 100;
          const normalizedAttemptScore =
            (attemptAvgScore / Math.max(rubricPoints, 1)) * 100;
          attemptScores.push(normalizedAttemptScore);
        }
      }
    }
  });

  const avgScore =
    attemptScores.length > 0
      ? attemptScores.reduce((sum, score) => sum + score, 0) /
        attemptScores.length
      : 0;

  // Calculate average time per session in minutes (matching server logic)
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

  const totalSessions = filteredData.chats.length;
  const timeSpentMinutes = totalTimeSpent / 60.0;
  const avgMinutes =
    totalSessions > 0
      ? timeSpentMinutes / Math.max(totalSessions, 1)
      : timeSpentMinutes;

  // Calculate efficiency: score adjusted by time (bounded 0..100) - matching server logic
  const currentValue = Math.round(
    Math.max(
      0.0,
      Math.min(100.0, avgScore * (1.0 - Math.min(1.0, avgMinutes / 120.0)))
    )
  );

  // Generate trend data for the chart by grouping attempts by date
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
      const dayAttemptScores: number[] = [];

      dayAttempts.forEach((attempt) => {
        const attemptChats = filteredData.chats.filter(
          (chat) => chat.attemptId === attempt.id
        );

        const simulation = filteredData.simulations.find(
          (s) => s.id === attempt.simulationId
        );
        const totalExpected =
          simulation?.scenarioIds?.length || attemptChats.length || 0;

        if (totalExpected === 0) {
          return;
        }

        const completedChats = attemptChats.filter((chat) => chat.completed);

        if (completedChats.length === 0) {
          return;
        }

        let totalScore = 0;

        for (let i = 0; i < totalExpected; i++) {
          const expectedChat = attemptChats[i];
          if (expectedChat && expectedChat.completed) {
            const grade = filteredData.grades.find(
              (g) => g.simulationChatId === expectedChat.id
            );
            totalScore += grade?.score || 0;
          }
        }

        const attemptAvgScore = totalScore / totalExpected;

        if (attemptChats.length > 0) {
          const firstChat = attemptChats[0];
          if (firstChat) {
            const grade = filteredData.grades.find(
              (g) => g.simulationChatId === firstChat.id
            );
            if (grade) {
              const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
              const rubricPoints = rubric?.points || 100;
              const normalizedAttemptScore =
                (attemptAvgScore / Math.max(rubricPoints, 1)) * 100;
              dayAttemptScores.push(normalizedAttemptScore);
            }
          }
        }
      });

      const dayAvgScore =
        dayAttemptScores.length > 0
          ? dayAttemptScores.reduce((sum, score) => sum + score, 0) /
            dayAttemptScores.length
          : 0;

      // Calculate day-specific time spent
      const dayTimeSpent = filteredData.chats.reduce((sum, chat) => {
        const chatAttempt = filteredData.attempts.find(
          (a) => a.id === chat.attemptId
        );
        if (
          chatAttempt &&
          format(new Date(chatAttempt.createdAt), "yyyy-MM-dd") === dateStr &&
          chat.completedAt
        ) {
          const timeSpent =
            (new Date(chat.completedAt).getTime() -
              new Date(chat.createdAt).getTime()) /
            1000;
          return sum + timeSpent;
        }
        return sum;
      }, 0);

      const daySessions = filteredData.chats.filter((chat) => {
        const chatAttempt = filteredData.attempts.find(
          (a) => a.id === chat.attemptId
        );
        return (
          chatAttempt &&
          format(new Date(chatAttempt.createdAt), "yyyy-MM-dd") === dateStr
        );
      }).length;

      const dayTimeSpentMinutes = dayTimeSpent / 60.0;
      const dayAvgMinutes =
        daySessions > 0
          ? dayTimeSpentMinutes / Math.max(daySessions, 1)
          : dayTimeSpentMinutes;

      const dayEfficiency = Math.round(
        Math.max(
          0.0,
          Math.min(
            100.0,
            dayAvgScore * (1.0 - Math.min(1.0, dayAvgMinutes / 120.0))
          )
        )
      );

      return {
        date: format(new Date(dateStr), "MM/dd"),
        value: dayEfficiency,
        count: dayAttempts.length,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    currentValue,
    trendData,
    // Trend data is intentionally empty; base it on actual data presence
    hasData: attemptScores.length > 0 || filteredData.chats.length > 0,
  };
};

/**
 * Calculate stagnation rate (matching server logic)
 * @param filteredData - FilteredData - Pre-filtered analytics data
 * @param rubrics - All rubrics for score calculation
 * @returns AnalyticsResult with stagnation rate and trend data
 */
export const calculateStagnationRate = (
  filteredData: FilteredData,
  rubrics: Rubric[]
): AnalyticsResult => {
  if (filteredData.grades.length === 0) {
    return { currentValue: 0, trendData: [], hasData: false };
  }

  // Stagnation rate: percent of non-increasing score transitions over time
  let sortedGrades = [...filteredData.grades];
  try {
    sortedGrades = sortedGrades.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  } catch {
    // Keep original order if sorting fails
  }

  let stagnant = 0;
  let transitions = 0;
  let prevNorm: number | null = null;

  for (const grade of sortedGrades) {
    const rubric = rubrics.find((r) => r.id === grade.rubricId);
    const rubricPoints = rubric?.points || 100;
    const norm = (grade.score / Math.max(rubricPoints, 1)) * 100;

    if (prevNorm !== null) {
      transitions += 1;
      if (norm <= prevNorm + 0.1) {
        stagnant += 1;
      }
    }
    prevNorm = norm;
  }

  const currentValue =
    transitions > 0 ? Math.round((stagnant / transitions) * 100) : 0;

  // Generate trend data for the chart by grouping grades by date
  const gradesByDate = new Map<string, typeof sortedGrades>();

  sortedGrades.forEach((grade) => {
    const dateStr = format(new Date(grade.createdAt), "yyyy-MM-dd");
    if (!gradesByDate.has(dateStr)) {
      gradesByDate.set(dateStr, []);
    }
    gradesByDate.get(dateStr)!.push(grade);
  });

  const trendData: AnalyticsDataPoint[] = Array.from(gradesByDate.entries())
    .map(([dateStr, dayGrades]) => {
      let dayStagnant = 0;
      let dayTransitions = 0;
      let prevNorm: number | null = null;

      for (const grade of dayGrades) {
        const rubric = rubrics.find((r) => r.id === grade.rubricId);
        const rubricPoints = rubric?.points || 100;
        const norm = (grade.score / Math.max(rubricPoints, 1)) * 100;

        if (prevNorm !== null) {
          dayTransitions += 1;
          if (norm <= prevNorm + 0.1) {
            dayStagnant += 1;
          }
        }
        prevNorm = norm;
      }

      const dayStagnationRate =
        dayTransitions > 0
          ? Math.round((dayStagnant / dayTransitions) * 100)
          : 0;

      return {
        date: format(new Date(dateStr), "MM/dd"),
        value: dayStagnationRate,
        count: dayGrades.length,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    currentValue,
    trendData,
    // Trend data is intentionally empty; base it on computed transitions
    hasData: transitions > 0,
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
