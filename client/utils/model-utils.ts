/**
 * Model utility functions
 * Simple client-side utilities for model/provider display
 */

/**
 * Mask API key for display purposes
 * Shows first 4 and last 4 characters, masks the middle
 */
export const maskApiKey = (apiKey: string): string => {
  if (!apiKey || apiKey.length < 8) {
    return "••••••••";
  }

  const start = apiKey.substring(0, 4);
  const end = apiKey.substring(apiKey.length - 4);
  const middle = "•".repeat(Math.max(8, apiKey.length - 8));

  return `${start}${middle}${end}`;
};
