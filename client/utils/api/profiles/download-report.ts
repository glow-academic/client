/**
 * download-report.ts
 * Used to download a student report as a PDF.
 * @AshokSaravanan222 & @siladiea
 * 06/24/2025
 */
"use server";
import { getApiUrl } from "../../../lib/utils";

export async function downloadReport(
  profileId: string,
  queryParams: string
): Promise<Response> {
  const response = await fetch(
    `${getApiUrl()}/profiles/${profileId}/report?${queryParams}`,
    {
      method: "GET",
    }
  );
  return response;
}
