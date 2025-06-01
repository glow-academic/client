import { QuizData } from './get-quiz';

/**
 * Fetches quizzes for users
 */

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
      studentInteractions: quiz.studentInteractions || quiz.student_interactions || {
        aggressive: [],
        happy: [],
        confused: []
      },
      createdAt: quiz.createdAt || quiz.created_at || new Date().toISOString()
    }));
  } catch (error) {
    console.error("Error fetching quizzes:", error);
    return [];
  }
}

export async function getQuizzesForUser(userId: string): Promise<QuizData[]> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/quiz/user/${userId}`,
      {
        credentials: "include",
      }
    );

    if (!response.ok) {
      if (response.status === 405) {
        // Method not allowed, endpoint might not exist yet
        console.warn("Quiz user endpoint not implemented yet");
        return [];
      }
      throw new Error("Failed to fetch user quizzes");
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching user quizzes:", error);
    return [];
  }
}
