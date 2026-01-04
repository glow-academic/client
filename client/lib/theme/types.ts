/**
 * Theme tokens type definition derived from server schema.
 * These tokens map to CSS variables used throughout the application.
 */
import type { SettingsActiveClient } from "@/app/(main)/layout-server";

/**
 * ThemeTokens type derived from SettingsActiveClient.
 * SettingsActiveClient includes tokens field from LayoutContextOut.
 * This ensures type safety between server and client.
 */
export type ThemeTokens = NonNullable<SettingsActiveClient["tokens"]>;
