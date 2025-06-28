/**
 * process-course.ts
 * Used to process a course.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiBase } from "@/lib/api-base";
import { logError } from "@/utils/logger";

export interface ProcessCourseParams {
  classId: string;
}

export interface ProcessCourseResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
  updates_made?: string[];
  documents_count?: number;
  course_info?: Record<string, unknown>;
  debug_info?: string;
}

export async function processCourse(
  classId: string
): Promise<ProcessCourseResponse> {
  try {
    const response = await fetch(
      `${getApiBase()}/documents/course?class_id=${classId}`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        `Failed to process course: ${response.status} ${response.statusText}`;
      logError(errorMessage);
      return {
        success: false,
        message: errorMessage,
        status: "error",
      };
    }

    const result = await response.json();
    return {
      success: true,
      message: result.message || "Course processed successfully",
      status: result.status || "success",
      updates_made: result.updates_made,
      documents_count: result.documents_count,
      course_info: result.course_info,
      debug_info: result.debug_info,
    };
  } catch (error) {
    const errorMessage = `Error processing course ${classId}: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError(errorMessage, error);
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}
