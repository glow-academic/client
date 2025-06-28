/**
 * Get the API URL based on the environment
 *
 * @returns The API URL
 */

"use server";
export async function getApiUrl(): Promise<string> {
  const serverPort = process.env["SERVER_PORT"];
  return `http://localhost:${serverPort}`;
}
