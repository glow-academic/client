/**
 * Per-artifact download URL routing.
 *
 * The backend exposes both a generic `/system/<type>/download` and
 * per-artifact `/<artifact>/<type>/download` endpoints. The per-artifact
 * surface emits clean per-section audit events (`persona.text_download.*`
 * etc.) that section UIs can subscribe to without cross-talk.
 *
 * Migration is artifact-by-artifact: each new BFF route added under
 * `app/api/<artifact>/...` extends the allowlist below. Until an
 * artifact is migrated, callers fall back to the system surface — so
 * adding entries to {@link MIGRATED_DOWNLOAD_ARTIFACTS} is the only
 * code-level switch needed once a new BFF route lands.
 */

/** Artifacts whose `/api/<artifact>/text/[textId]` and
 *  `/api/<artifact>/call/[callId]` BFF routes exist.
 *
 *  ``system`` is intentionally NOT listed — the helper falls back to
 *  ``system`` for any unmigrated artifact, and the existing
 *  ``/api/system/<type>/[id]`` BFF routes already cover that path. */
export const MIGRATED_DOWNLOAD_ARTIFACTS: ReadonlySet<string> = new Set([
  "agent",
  "attempt",
  "auth",
  "cohort",
  "department",
  "document",
  "eval",
  "field",
  "model",
  "parameter",
  "persona",
  "profile",
  "provider",
  "rubric",
  "scenario",
  "setting",
  "simulation",
  "test",
  "tool",
]);

/** BFF base segment to use for downloads scoped to ``artifact``.
 *  Falls back to ``"system"`` for artifacts not yet migrated. */
export function downloadBase(artifact: string): string {
  return MIGRATED_DOWNLOAD_ARTIFACTS.has(artifact) ? artifact : "system";
}

/** Convenience: full BFF URL for a text download. */
export function textDownloadUrl(artifact: string, textId: string): string {
  return `/api/${downloadBase(artifact)}/text/${textId}`;
}

/** Convenience: full BFF URL for a call download. */
export function callDownloadUrl(artifact: string, callId: string): string {
  return `/api/${downloadBase(artifact)}/call/${callId}`;
}
