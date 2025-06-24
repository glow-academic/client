/**
 * download-report.ts
 * Used to download a student report as a PDF.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { logError, logInfo } from "@/utils/logger";
// Note: No longer importing getApiUrl since we're using Next.js API routes

export interface DownloadReportParams {
  profileId: string;
  includeStudentTypeChart?: boolean;
  includePerformanceChart?: boolean;
  includeRadarChart?: boolean;
  includeTimeChart?: boolean;
  includeDetailedScores?: boolean;
  includeFeedback?: boolean;
}

export interface DownloadReportResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
  data?: Response;
  headers?: Headers;
  blob?: () => Promise<Blob>;
  filename?: string;
}

export async function downloadReport(
  profileId: string,
  options: {
    includeStudentTypeChart?: boolean;
    includePerformanceChart?: boolean;
    includeRadarChart?: boolean;
    includeTimeChart?: boolean;
    includeDetailedScores?: boolean;
    includeFeedback?: boolean;
  } = {}
): Promise<DownloadReportResponse> {
  try {
    logInfo(`Downloading report for profile ${profileId}`, {
      profileId,
      options,
    });

    // Build query parameters
    const queryParams = new URLSearchParams();
    if (options.includeStudentTypeChart !== undefined) {
      queryParams.set(
        "includeStudentTypeChart",
        options.includeStudentTypeChart.toString()
      );
    }
    if (options.includePerformanceChart !== undefined) {
      queryParams.set(
        "includePerformanceChart",
        options.includePerformanceChart.toString()
      );
    }
    if (options.includeRadarChart !== undefined) {
      queryParams.set(
        "includeRadarChart",
        options.includeRadarChart.toString()
      );
    }
    if (options.includeTimeChart !== undefined) {
      queryParams.set("includeTimeChart", options.includeTimeChart.toString());
    }
    if (options.includeDetailedScores !== undefined) {
      queryParams.set(
        "includeDetailedScores",
        options.includeDetailedScores.toString()
      );
    }
    if (options.includeFeedback !== undefined) {
      queryParams.set("includeFeedback", options.includeFeedback.toString());
    }

    // Use the Next.js API route instead of calling FastAPI directly
    const url = `/api/download/report/${profileId}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      // Try to get error details from JSON response
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = {};
      }

      const errorMessage =
        errorData.message ||
        `Failed to download report: ${response.status} ${response.statusText}`;
      logError(errorMessage);
      return {
        success: false,
        message: errorMessage,
        status: "error",
      };
    }

    // Extract filename from Content-Disposition header
    const contentDisposition = response.headers.get("content-disposition");
    const filename = contentDisposition
      ? contentDisposition.split("filename=")[1]?.replace(/"/g, "") ||
        `TA_Report_${profileId}.pdf`
      : `TA_Report_${profileId}.pdf`;

    logInfo(`Report downloaded successfully for profile ${profileId}`, {
      profileId,
      filename,
      contentType: response.headers.get("content-type"),
    });

    return {
      success: true,
      message: "Report downloaded successfully",
      status: "success",
      data: response,
      headers: response.headers,
      blob: () => response.blob(),
      filename,
    };
  } catch (error) {
    const errorMessage = `Error downloading report for profile ${profileId}: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError(errorMessage, error);
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}

// Legacy function for backward compatibility
export async function downloadReportLegacy(
  profileId: string,
  queryParams: string
): Promise<Response> {
  // Use the Next.js API route for legacy compatibility
  const response = await fetch(
    `/api/download/report/${profileId}?${queryParams}`,
    {
      method: "GET",
      credentials: "include",
    }
  );
  return response;
}
