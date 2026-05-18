/**
 * useArtifactGhosts — list-page liveness for audited write operations.
 *
 * Subscribes to `<artifactType>.<op>.started/.progress/.completed/.failed`
 * for the requested ops and surfaces:
 *
 *   - `ghosts`: active overlays (creating / updating / deleting / pending /
 *     failed). The list/table renders these above the real rows so the
 *     user sees the operation in flight (and pending soft-write state).
 *   - `mergedRows`: SSR-seeded base rows merged with `.completed` payloads
 *     — surgical local update, no `router.refresh()` and no duplicate
 *     `/<X>/context|group|search` burst.
 *   - `ack(callId, accept)`: Accept/Reject for soft-pending state. Same
 *     `ackOperation` server action the GenerationPanel's CallReceiptBody
 *     uses, so a list-card button and a panel-bubble button stay in sync
 *     by `call_id` (the audit's wire-level identity).
 *
 * Cross-tab consistency: audit events route by `room=profile_id`, so any
 * tab the user has open on the same artifact list reduces the same
 * stream into the same `mergedRows`.
 */
"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { ackOperation } from "@/lib/api/ack";
import { useTransport } from "@/lib/transport";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type GhostOp = "create" | "update" | "delete" | "duplicate";

export type GhostState =
  | "creating"
  | "updating"
  | "deleting"
  | "duplicating"
  | "pending"
  | "accepted"
  | "rejected"
  | "committed"
  | "failed";

export interface Ghost<TRow> {
  /** Wire-level identity from the audit framework. Same `call_id` the
   *  GenerationPanel's bubble uses, so cross-surface state lookups
   *  (highlight matching row, etc.) are by this key. */
  callId: string;
  op: GhostOp;
  state: GhostState;
  /** Existing row's id for update/delete; null for create until the
   *  `.completed` payload lands the canonical id. */
  rowId: string | null;
  /** Streaming `.progress` args (cumulative; the audit framework spreads
   *  the latest parsed args on each emit). After `.completed` lands,
   *  partial holds the impl's output payload. */
  partial: Partial<TRow> & Record<string, unknown>;
  /** Snapshot for diff display (update/delete only). Resolved from
   *  baseRows at `.started` time when available; falls back to the
   *  audit's `.started` payload if the server denormalized it. */
  before: TRow | null;
  /** Tool resource envelope when the audit attached one (LLM tool-call
   *  audits carry it). Lets the list card cross-link with the panel
   *  bubble's tool-call view. */
  tool: Record<string, unknown> | null;
  /** Last error message when state === "failed". */
  error: string | null;
  /** Original arguments at .started — used to detect soft-vs-immediate. */
  arguments: Record<string, unknown>;
}

export interface UseArtifactGhostsResult<TRow> {
  ghosts: Ghost<TRow>[];
  ghostsByCallId: Record<string, Ghost<TRow>>;
  mergedRows: TRow[];
  ack: (callId: string, accept: boolean) => Promise<void>;
  /** Drop a terminal ghost (committed/accepted/rejected/failed) from
   *  local state. The rail decides the linger timing — the hook itself
   *  doesn't auto-drop because list pages may want different behaviors. */
  drop: (callId: string) => void;
}

export interface UseArtifactGhostsConfig<TRow> {
  artifactType: string;
  ops: GhostOp[];
  baseRows: TRow[];
  /** Field on TRow that holds the canonical id. Default: "id". */
  rowKey?: keyof TRow & string;
  /** Override the lookup used for update/delete `before` snapshots.
   *  Defaults to baseRows scan by rowKey. Useful if your row identifier
   *  doesn't match the audit's `id` argument. */
  resolveBefore?: (rowId: string) => TRow | undefined;
  /** Wire-payload field that carries the impl's hydrated rows on
   *  ``.completed``. Defaults to ``${artifactType}s`` (e.g. "personas").
   *  Override for irregular plurals. The impl's create/update/duplicate
   *  responses must include this field with rows in the same shape as
   *  the artifact's list endpoint — see ``hydrate_<X>_list_rows``. */
  artifactPlural?: string;
  /** Called once per ghost when its operation actually commits — i.e.
   *  ``.completed`` arrived for an immediate write, OR an ``ack(true)``
   *  was applied to a soft-pending one. Caller typically wires
   *  ``router.refresh()`` here so the SSR list picks up the new/changed
   *  row with all FK-resolved fields populated (the hook's local row
   *  reconstruction only carries the LLM's streaming args + the impl's
   *  status response, which lack denormalized labels like color hex,
   *  icon SVG, scenario counts, etc.). Soft-skipped failures and
   *  rejected acks do NOT fire this. */
  onCommit?: (callId: string, op: GhostOp) => void;
}

// ---------------------------------------------------------------------------
// Internal — reducer
// ---------------------------------------------------------------------------

type GhostMap<TRow> = Record<string, Ghost<TRow>>;

interface State<TRow> {
  /** call_id → Ghost. Insertion order = arrival; we sort newest-first
   *  on read via the `ghosts` array projection. */
  byCallId: GhostMap<TRow>;
  /** call_id ordered insertion list (newest last). */
  order: string[];
  /** Local overlay applied on top of baseRows: appended new rows from
   *  create/duplicate completes, replaced rows from update completes,
   *  hidden rowIds from delete-in-flight. The real merged view is
   *  computed in `useMemo` against the latest baseRows on each render. */
  added: TRow[];
  replaced: Record<string, TRow>;
  hiddenIds: Set<string>;
}

type Action<TRow> =
  | { type: "started"; op: GhostOp; callId: string; payload: Record<string, unknown>; before: TRow | null }
  | { type: "progress"; callId: string; payload: Record<string, unknown> }
  | { type: "completed"; callId: string; payload: Record<string, unknown>; rowKey: string; artifactPlural: string }
  | { type: "failed"; callId: string; payload: Record<string, unknown> }
  | { type: "ackOptimistic"; callId: string; accept: boolean; rowKey: string; artifactPlural: string }
  | { type: "drop"; callId: string };

function isSoft(args: Record<string, unknown>): boolean {
  return args["soft"] === true;
}

function reducer<TRow>(state: State<TRow>, action: Action<TRow>): State<TRow> {
  switch (action.type) {
    case "started": {
      const { op, callId, payload, before } = action;
      // De-dup: if a started arrives for an existing callId (replay /
      // late SSE), keep the newer payload but preserve order.
      const stateMap: GhostState =
        op === "create" ? "creating" :
        op === "duplicate" ? "duplicating" :
        op === "update" ? "updating" :
        "deleting";
      const existing = state.byCallId[callId];
      // Resolve the affected row id from the payload. Update/delete
      // can carry ``id`` (single, e.g. /<X>/duplicate input) or
      // ``ids`` (bulk, e.g. /<X>/delete with one or many ids). The
      // ghost shows ONE card per callId, so we take the first id —
      // bulk deletes that affect N rows still produce one ghost
      // (matches the audit lifecycle which fires one ``.started``
      // per call regardless of N).
      const payloadId = payload["id"];
      const payloadIds = payload["ids"];
      const resolvedRowId =
        typeof payloadId === "string"
          ? payloadId
          : Array.isArray(payloadIds) && payloadIds.length > 0 && typeof payloadIds[0] === "string"
          ? (payloadIds[0] as string)
          : (existing?.rowId ?? null);
      const ghost: Ghost<TRow> = {
        callId,
        op,
        state: stateMap,
        rowId: resolvedRowId,
        partial: { ...payload } as Partial<TRow> & Record<string, unknown>,
        before: before ?? existing?.before ?? null,
        tool: (payload["tool"] as Record<string, unknown> | null) ?? null,
        error: null,
        arguments: { ...payload },
      };
      const order = existing ? state.order : [...state.order, callId];
      // For delete: hide the row immediately so the visual "move to top"
      // is just the ghost rail entry. The hidden rowId comes back if
      // the operation fails or rejects.
      const hiddenIds = new Set(state.hiddenIds);
      if (op === "delete" && ghost.rowId) hiddenIds.add(ghost.rowId);
      return {
        ...state,
        byCallId: { ...state.byCallId, [callId]: ghost },
        order,
        hiddenIds,
      };
    }

    case "progress": {
      const existing = state.byCallId[action.callId];
      if (!existing) return state;
      // Audit's `.progress` carries the latest parsed args spread to
      // top-level, so a replace is correct (cumulative semantics).
      const next: Ghost<TRow> = {
        ...existing,
        partial: { ...existing.partial, ...action.payload },
      };
      return { ...state, byCallId: { ...state.byCallId, [action.callId]: next } };
    }

    case "completed": {
      const existing = state.byCallId[action.callId];
      if (!existing) return state;
      const soft = isSoft(existing.arguments);
      const partial = { ...existing.partial, ...action.payload };
      const next: Ghost<TRow> = {
        ...existing,
        partial,
        state: soft ? "pending" : "committed",
      };
      // Apply local overlay only for the immediate path. Soft pending
      // stays as a ghost-only entry until the ack fires.
      if (!soft) {
        return applyOverlay(state, next, action.rowKey, action.payload, action.artifactPlural);
      }
      return { ...state, byCallId: { ...state.byCallId, [action.callId]: next } };
    }

    case "failed": {
      const existing = state.byCallId[action.callId];
      if (!existing) return state;
      const next: Ghost<TRow> = {
        ...existing,
        state: "failed",
        error: typeof action.payload["message"] === "string" ? (action.payload["message"] as string) : "Operation failed",
      };
      // Restore hidden delete rows on failure.
      const hiddenIds = new Set(state.hiddenIds);
      if (existing.op === "delete" && existing.rowId) hiddenIds.delete(existing.rowId);
      return { ...state, byCallId: { ...state.byCallId, [action.callId]: next }, hiddenIds };
    }

    case "ackOptimistic": {
      const existing = state.byCallId[action.callId];
      if (!existing) return state;
      const accepted: Ghost<TRow> = { ...existing, state: action.accept ? "accepted" : "rejected" };
      // Optimistic commit: on accept, materialize into mergedRows now.
      // On reject, restore any hidden delete row.
      if (action.accept) {
        return applyOverlay(state, accepted, action.rowKey, existing.partial as Record<string, unknown>, action.artifactPlural);
      } else {
        const hiddenIds = new Set(state.hiddenIds);
        if (existing.op === "delete" && existing.rowId) hiddenIds.delete(existing.rowId);
        return { ...state, byCallId: { ...state.byCallId, [action.callId]: accepted }, hiddenIds };
      }
    }

    case "drop": {
      if (!state.byCallId[action.callId]) return state;
      const { [action.callId]: _, ...rest } = state.byCallId;
      return {
        ...state,
        byCallId: rest,
        order: state.order.filter((id) => id !== action.callId),
      };
    }
  }
}

/** Apply a committed/accepted ghost's effect to the local overlay maps.
 *
 *  Drives off ``output.<artifactPlural>`` — the impl's response field
 *  carrying fully-hydrated rows (same shape ``/<artifact>/search``
 *  returns). Per the bulk-write recipe, create/duplicate/update impls
 *  call ``hydrate_<artifact>_list_rows`` and include the result here
 *  so the audit ``.completed`` payload self-describes the new state.
 *
 *  Without those rows in ``output``, the hook falls back to a no-op
 *  for create/update — the row will only appear after a separate
 *  refresh. Delete is unaffected (row is already in baseRows; hide
 *  by id from ``ghost.rowId``).
 */
function applyOverlay<TRow>(
  state: State<TRow>,
  ghost: Ghost<TRow>,
  rowKey: string,
  output: Record<string, unknown>,
  artifactPlural: string,
): State<TRow> {
  const hiddenIds = new Set(state.hiddenIds);
  let added = state.added;
  let replaced = state.replaced;

  // Server-denormalized rows live under ``<artifactPlural>`` (e.g.
  // ``personas`` for create/update/duplicate). Single-element list for
  // duplicate; multi-element for bulk create/update.
  const hydrated = output[artifactPlural];
  const hydratedRows: TRow[] = Array.isArray(hydrated) ? (hydrated as TRow[]) : [];

  if (ghost.op === "create" || ghost.op === "duplicate") {
    if (hydratedRows.length > 0) {
      added = [...added, ...hydratedRows];
    }
  } else if (ghost.op === "update") {
    if (hydratedRows.length > 0) {
      const next = { ...replaced };
      for (const row of hydratedRows) {
        const id = row[rowKey as keyof TRow] as unknown as string | undefined;
        if (id) next[id] = row;
      }
      replaced = next;
    }
  } else if (ghost.op === "delete") {
    if (ghost.rowId) hiddenIds.add(ghost.rowId);
  }

  return {
    ...state,
    byCallId: { ...state.byCallId, [ghost.callId]: ghost },
    added,
    replaced,
    hiddenIds,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const initialState = <TRow>(): State<TRow> => ({
  byCallId: {},
  order: [],
  added: [],
  replaced: {},
  hiddenIds: new Set<string>(),
});

export function useArtifactGhosts<TRow extends Record<string, unknown>>(
  config: UseArtifactGhostsConfig<TRow>,
): UseArtifactGhostsResult<TRow> {
  const { artifactType, ops, baseRows, rowKey = "id" as keyof TRow & string, resolveBefore, onCommit } = config;
  const artifactPlural = config.artifactPlural ?? `${artifactType}s`;

  const transport = useTransport();
  const [state, dispatch] = useReducer(reducer<TRow>, undefined, initialState);

  // Keep latest baseRows + resolver in refs for in-listener lookups.
  const baseRowsRef = useRef(baseRows);
  baseRowsRef.current = baseRows;
  const resolveBeforeRef = useRef(resolveBefore);
  resolveBeforeRef.current = resolveBefore;
  const rowKeyRef = useRef(rowKey);
  rowKeyRef.current = rowKey;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    for (const op of ops) {
      const prefix = `${artifactType}.${op}`;
      const startedEvent = `${prefix}.started`;
      const progressEvent = `${prefix}.progress`;
      const completedEvent = `${prefix}.completed`;
      const failedEvent = `${prefix}.failed`;

      unsubs.push(
        transport.on(startedEvent, (raw) => {
          const callId = raw["call_id"];
          if (typeof callId !== "string") return;
          // Resolve "before" snapshot when the op needs one. Audit
          // payloads spread the request body to top-level, so the
          // affected row id is in either ``id`` (single — e.g.
          // /X/duplicate input) or ``ids`` (bulk — e.g. /X/delete).
          let before: TRow | null = null;
          if ((op === "update" || op === "delete")) {
            const rawId = raw["id"];
            const rawIds = raw["ids"];
            const rid =
              typeof rawId === "string"
                ? rawId
                : Array.isArray(rawIds) && rawIds.length > 0 && typeof rawIds[0] === "string"
                ? (rawIds[0] as string)
                : null;
            // Prefer server-denormalized snapshot when present, falling
            // back to local lookup. (Server denorm is the planned source
            // of truth for cross-page diff support — see open question
            // B in the design doc.)
            const denorm = raw["before"];
            if (denorm && typeof denorm === "object") {
              before = denorm as TRow;
            } else if (rid) {
              const lookup = resolveBeforeRef.current
                ? resolveBeforeRef.current(rid)
                : baseRowsRef.current.find((r) => r[rowKeyRef.current] === rid);
              before = lookup ?? null;
            }
          }
          dispatch({ type: "started", op, callId, payload: raw, before });
        }),
      );
      unsubs.push(
        transport.on(progressEvent, (raw) => {
          const callId = raw["call_id"];
          if (typeof callId !== "string") return;
          dispatch({ type: "progress", callId, payload: raw });
        }),
      );
      unsubs.push(
        transport.on(completedEvent, (raw) => {
          const callId = raw["call_id"];
          if (typeof callId !== "string") return;
          // Skip the SECOND `.completed` that an ack call produces for
          // soft writes — its `arguments.accept` discriminator tells us
          // it's an ack response, not the original op's completion.
          // ackOptimistic has already updated state; the server-side
          // commit is implicit.
          if ("accept" in raw) return;
          dispatch({ type: "completed", callId, payload: raw, rowKey: rowKeyRef.current, artifactPlural });
          // Fire onCommit only for the immediate-write path (i.e. NOT
          // soft). Mirrors the reducer's branching — soft completions
          // park in "pending" state until ack(true) fires onCommit
          // there. Outer `if (raw["soft"])` is the wire-level mirror
          // of the reducer's ``isSoft(arguments)`` check; arguments
          // are spread to top-level on completed events.
          if (raw["soft"] !== true) {
            onCommitRef.current?.(callId, op);
          }
        }),
      );
      unsubs.push(
        transport.on(failedEvent, (raw) => {
          const callId = raw["call_id"];
          if (typeof callId !== "string") return;
          dispatch({ type: "failed", callId, payload: raw });
        }),
      );
    }
    return () => { for (const off of unsubs) off(); };
  }, [transport, artifactType, ops.join(",")]);

  // ---- Derived views ----

  const ghosts = useMemo<Ghost<TRow>[]>(() => {
    // Newest first.
    return state.order
      .map((id) => state.byCallId[id])
      .filter((g): g is Ghost<TRow> => Boolean(g))
      .reverse();
  }, [state.order, state.byCallId]);

  const ghostsByCallId = state.byCallId;

  const mergedRows = useMemo<TRow[]>(() => {
    const out: TRow[] = [];
    for (const row of baseRows) {
      const id = row[rowKey] as unknown as string | undefined;
      if (id && state.hiddenIds.has(id)) continue;
      if (id && state.replaced[id]) {
        out.push(state.replaced[id] as TRow);
      } else {
        out.push(row);
      }
    }
    // Appended rows from create/duplicate go to the FRONT — matches the
    // visual "ghost lives at the top of the list, then materializes in
    // place" rule. Listing-page sort/pagination is applied by the table
    // on top of this; the rail sits above the table regardless, so this
    // ordering only matters for the post-commit "sit briefly at top
    // before refreshing settles them into natural order" behavior.
    return [...state.added, ...out];
  }, [baseRows, rowKey, state.added, state.replaced, state.hiddenIds]);

  // ---- Ack ----

  const ack = useCallback(async (callId: string, accept: boolean) => {
    const ghost = state.byCallId[callId];
    if (!ghost) return;
    // Optimistic: flip state immediately so the UI is snappy. The
    // server's second `.completed` lands the canonical post-ack
    // payload, but we drop those (see effect above) to avoid double-
    // applying the overlay.
    dispatch({ type: "ackOptimistic", callId, accept, rowKey: rowKeyRef.current, artifactPlural });
    // Accept-ack is the soft-path equivalent of an immediate `.completed`
    // — the ghost transitions to "accepted" and the row materializes.
    // Reject-ack drops the ghost without committing; no fire.
    if (accept) {
      onCommitRef.current?.(callId, ghost.op);
    }
    try {
      await ackOperation({
        artifact: artifactType,
        operation: ghost.op,
        idempotencyKey: callId,
        accept,
      });
    } catch (e) {
      // Server rejected the ack — surface as failed. The optimistic
      // flip is preserved (better than silently reverting to pending);
      // the user can read the error and try again.
      dispatch({
        type: "failed",
        callId,
        payload: { message: e instanceof Error ? e.message : "Ack failed" },
      });
    }
  }, [artifactType, state.byCallId]);

  const drop = useCallback((callId: string) => {
    dispatch({ type: "drop", callId });
  }, []);

  return { ghosts, ghostsByCallId, mergedRows, ack, drop };
}
