/**
 * Theme tokens type definition derived from server schema.
 * These tokens map to CSS variables used throughout the application.
 */
import type { AuthSettingsResponse } from "@/app/(main)/layout-server";

/**
 * ThemeTokens type derived from AuthSettingsResponse.
 * This ensures type safety between server and client.
 */
export type ThemeTokens = NonNullable<AuthSettingsResponse["tokens"]>;
