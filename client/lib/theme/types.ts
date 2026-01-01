/**
 * Theme tokens type definition derived from server schema.
 * These tokens map to CSS variables used throughout the application.
 */
import type { OutputOf } from "@/lib/api/types";

/** ---- Strong type from OpenAPI ---- */
type SettingsActiveOut = OutputOf<"/api/v4/settings/active", "post">;

/**
 * ThemeTokens type derived from SettingsActiveOut response.
 * This ensures type safety between server and client.
 */
export type ThemeTokens = SettingsActiveOut["tokens"];
