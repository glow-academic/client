export interface QuizData {
  id: string;
  title: string;
  timeLimit: number;
  className: string;
  classCode: string;
  document: any;
  studentInteractions: {
    aggressive: Array<{ crowdedness: number; intensity: number }>;
    happy: Array<{ crowdedness: number; intensity: number }>;
    confused: Array<{ crowdedness: number; intensity: number }>;
  };
  createdAt: string;
}

export async function getQuiz(quizId: string): Promise<QuizData> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/quiz/${quizId}`,
      {
        credentials: "include",
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Quiz not found");
      }
      // The 405 error should be resolved by the new backend endpoint.
      // If it still occurs, it might indicate a different issue (e.g., proxy, server config).
      // if (response.status === 405) {
      //   throw new Error("Quiz endpoint not implemented yet or method not allowed.");
      // }
      const errorData = await response.json().catch(() => ({})); // Try to parse error
      throw new Error(errorData.detail || `Failed to fetch quiz: ${response.statusText} (status: ${response.status})`);
    }

    const data = await response.json();

    // Transform the data to match the expected format
    return {
      id: data.id,
      title: data.title,
      timeLimit: data.timeLimit || data.time_limit, // Handle both formats
      className: data.class?.name || data.className || "Unknown Class",
      classCode: data.class?.classCode || data.class?.class_code || "Unknown",
      document: data.document,
      studentInteractions:
        data.studentInteractions || data.student_interactions || {
          aggressive: [],
          happy: [],
          confused: [],
        },
      createdAt: data.createdAt || data.created_at || new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error fetching quiz:", error);
    throw error;
  }
}

export async function getQuizzes(): Promise<QuizData[]> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/quiz`, {
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 405) {
        // Method not allowed, endpoint might not exist yet
        console.warn("Quiz endpoint not implemented yet");
        return [];
      }
      throw new Error("Failed to fetch quizzes");
    }

    const data = await response.json();

    return data.map((quiz: any) => ({
      id: quiz.id,
      title: quiz.title,
      timeLimit: quiz.timeLimit || quiz.time_limit,
      className: quiz.class?.name || quiz.className || "Unknown Class",
      classCode: quiz.class?.classCode || quiz.class?.class_code || "Unknown",
      document: quiz.document,
      studentInteractions:
        quiz.studentInteractions || quiz.student_interactions || {
          aggressive: [],
          happy: [],
          confused: [],
        },
      createdAt: quiz.createdAt || quiz.created_at || new Date().toISOString(),
    }));
  } catch (error) {
    console.error("Error fetching quizzes:", error);
    return [];
  }
}
