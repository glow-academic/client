/**
 * process-course.ts
 * Used to process a course.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiUrl } from "../../../lib/utils";

export async function processCourse(classId: string): Promise<Response> {
    const response = await fetch(`${getApiUrl()}/documents/course?class_id=${classId}`, {
        method: "POST",
    });
    return response;
}