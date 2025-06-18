// utils/client-model.ts
// Client-side utility functions for models
// @AshokSaravanan222 & @siladiea
// 06/18/2025

// Utility function to mask API key for display
export const maskApiKey = (apiKey: string): string => {
  if (!apiKey || apiKey.length < 8) {
    return "••••••••";
  }

  const start = apiKey.substring(0, 4);
  const end = apiKey.substring(apiKey.length - 4);
  const middle = "•".repeat(Math.max(8, apiKey.length - 8));

  return `${start}${middle}${end}`;
};
