/**
 * Create or Update a quiz
 */

export interface QuizFormData {
  title: string;
  classId: string;
  timeLimit: number;
  documentId?: string | null;
  studentInteractions: {
    aggressive: Array<{ crowdedness: number; intensity: number }>;
    happy: Array<{ crowdedness: number; intensity: number }>;
    confused: Array<{ crowdedness: number; intensity: number }>;
  };
}

export async function createQuiz(data: QuizFormData) {
  try {
    console.log("Creating quiz with data:", data);

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/quiz`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      credentials: "include",
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      let errorMessage = "Failed to create quiz";
      try {
        const errorData = await response.json();
        console.error("Error response:", errorData);
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch (parseError) {
        console.error("Failed to parse error response:", parseError);
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log("Quiz created successfully:", result);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error creating quiz:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function updateQuiz(quizId: string, data: QuizFormData) {
  try {
    console.log(`Updating quiz ${quizId} with data:`, data);
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/quiz/${quizId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      credentials: "include",
    });

    console.log("Update response status:", response.status);
    
    if (!response.ok) {
      let errorMessage = "Failed to update quiz";
      try {
        const errorData = await response.json();
        console.error("Error response (update):", errorData);
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch (parseError) {
        console.error("Failed to parse error response (update):", parseError);
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log("Quiz updated successfully:", result);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error updating quiz:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
