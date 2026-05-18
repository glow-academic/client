/**
 * Generation-panel preference cookies — server-side reader.
 *
 * Pages call ``readGenerationPanelPrefs()`` at render time and pass the
 * result into ``<GenerationPanel initialPanelPrefs={…} />`` so the
 * initial paint matches what the user last toggled. The panel writes
 * cookies back via ``document.cookie`` (client-side) so the next SSR
 * navigation picks up the change.
 *
 * Cookie names mirror the prefs literally: ``glow.gp.<key>``. Values
 * are ``"0"`` / ``"1"`` (no JSON, no encoding overhead). All three
 * default to ``false`` — sensible defaults for first-time visitors.
 */

import { cookies } from "next/headers";

import {
  DEFAULT_GENERATION_PANEL_PREFS,
  type GenerationPanelPrefs,
} from "@/components/common/ai/GenerationPanel";

const COOKIE_NAMES = {
  safeMode: "glow.gp.safeMode",
  showFullContext: "glow.gp.showFullContext",
  showUserTools: "glow.gp.showUserTools",
} as const;

export async function readGenerationPanelPrefs(): Promise<GenerationPanelPrefs> {
  const c = await cookies();
  const read = (name: string, fallback: boolean): boolean => {
    const v = c.get(name)?.value;
    if (v == null) return fallback;
    return v === "1";
  };
  return {
    safeMode: read(COOKIE_NAMES.safeMode, DEFAULT_GENERATION_PANEL_PREFS.safeMode),
    showFullContext: read(COOKIE_NAMES.showFullContext, DEFAULT_GENERATION_PANEL_PREFS.showFullContext),
    showUserTools: read(COOKIE_NAMES.showUserTools, DEFAULT_GENERATION_PANEL_PREFS.showUserTools),
  };
}
