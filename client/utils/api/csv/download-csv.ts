/**
 * download-csv.ts
 * Used to download CSV files from the MCP server using tokens
 * @AshokSaravanan222
 * 01/02/2025
 */

import { logError, logInfo } from "@/utils/logger";

export interface DownloadCsvResponse {
  success: boolean;
  message: string;
  status?: "success" | "error";
  filename?: string;
}

/**
 * Downloads a CSV file using a token from the MCP server
 * @param token - The CSV download token
 * @param filename - Optional filename for the download
 * @returns Promise<DownloadCsvResponse>
 */
export async function downloadCsv(
  token: string,
  filename?: string
): Promise<DownloadCsvResponse> {
  try {
    logInfo("Downloading CSV with token", { token, filename });

    // Use the existing download API route
    const response = await fetch(`/api/download/csv/token/${token}`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      const errorMessage = `Failed to download CSV: ${response.status} ${response.statusText}`;
      logError(errorMessage);
      return {
        success: false,
        message: errorMessage,
        status: "error",
      };
    }

    // Get the filename from the response headers or use the provided one
    const contentDisposition = response.headers.get("content-disposition");
    let downloadFilename = filename;

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      if (filenameMatch) {
        downloadFilename = filenameMatch[1];
      }
    }

    // Default filename if none provided
    if (!downloadFilename) {
      downloadFilename = `export_${new Date().toISOString().split("T")[0]}.csv`;
    }

    // Create blob and trigger download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    logInfo("CSV download completed successfully", {
      token,
      filename: downloadFilename,
      size: blob.size,
    });

    return {
      success: true,
      message: "CSV downloaded successfully",
      status: "success",
      filename: downloadFilename,
    };
  } catch (error) {
    const errorMessage = `Error downloading CSV: ${error instanceof Error ? error.message : "Unknown error"}`;
    logError(errorMessage, error);
    return {
      success: false,
      message: errorMessage,
      status: "error",
    };
  }
}

/**
 * Extracts CSV download token from assistant response text
 * @param text - The assistant response text
 * @returns Array of found tokens
 */
export function extractCsvTokens(text: string): string[] {
  // Look for CSV download links in the format: [Download CSV](csv://token)
  const csvLinkRegex = /\[([^\]]+)\]\(csv:\/\/([^)]+)\)/g;
  const tokens: string[] = [];
  let match;

  while ((match = csvLinkRegex.exec(text)) !== null) {
    if (match[2]) {
      tokens.push(match[2]); // The token is in the second capture group
    }
  }

  return tokens;
}
