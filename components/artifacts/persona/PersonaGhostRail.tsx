/**
 * PersonaGhostRail — live overlay above the personas list.
 *
 * Renders one card per active ghost from ``useArtifactGhosts``:
 *   - create / duplicate: skeleton card with the streaming name filling in
 *   - delete: existing-row card faded + strikethrough
 *   - update: deferred to a later commit (per Names.tsx-style diff plan)
 *   - pending (soft): Accept / Reject buttons that share state with the
 *     GenerationPanel's CallReceiptBody via ``call_id``
 *
 * Ghosts auto-disappear when their backing operation drops out of the
 * hook's state (committed-immediate path is briefly visible, then the
 * real row is in ``mergedRows`` and the ghost falls off — see the
 * ``DROP_AFTER_MS`` cleanup below).
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, Trash2, Sparkles, AlertCircle } from "lucide-react";
import { useEffect } from "react";

import type { Ghost } from "@/hooks/use-artifact-ghosts";

interface PersonaRow {
  persona_id?: string | null;
  name?: string | null;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
}

interface PersonaGhostRailProps {
  ghosts: Ghost<PersonaRow>[];
  ack: (callId: string, accept: boolean) => Promise<void>;
  /** Callback to drop a terminal ghost from local state after the
   *  brief "real row landed" animation. The hook itself doesn't auto-
   *  drop because the rail decides the timing. */
  onDrop?: (callId: string) => void;
}

/** How long a committed/accepted/rejected ghost lingers before being
 *  removed from the rail. The real row is already in ``mergedRows`` by
 *  this point, so the rail card is purely visual. */
const DROP_AFTER_MS = 1200;

export function PersonaGhostRail({ ghosts, ack, onDrop }: PersonaGhostRailProps) {
  // Auto-drop terminal ghosts after a short linger.
  useEffect(() => {
    if (!onDrop) return;
    const timers = ghosts
      .filter((g) => g.state === "committed" || g.state === "accepted" || g.state === "rejected" || g.state === "failed")
      .map((g) => setTimeout(() => onDrop(g.callId), DROP_AFTER_MS));
    return () => { timers.forEach(clearTimeout); };
  }, [ghosts, onDrop]);

  if (ghosts.length === 0) return null;

  return (
    <div
      className="space-y-2"
      data-testid="persona-ghost-rail"
      aria-label="In-flight persona operations"
    >
      {ghosts.map((g) => (
        <PersonaGhostCard key={g.callId} ghost={g} ack={ack} />
      ))}
    </div>
  );
}

function PersonaGhostCard({
  ghost,
  ack,
}: {
  ghost: Ghost<PersonaRow>;
  ack: (callId: string, accept: boolean) => Promise<void>;
}) {
  const isPending = ghost.state === "pending";
  const isFailed = ghost.state === "failed";
  const isDelete = ghost.op === "delete";

  // Source of truth for name display: prefer streaming partial; fall
  // back to the before-snapshot for delete (where the partial may not
  // carry the row name).
  const name =
    (ghost.partial as PersonaRow).name ||
    ghost.before?.name ||
    "Untitled Persona";

  // Visual variant by op + state. Delete + (deleting|pending) → muted +
  // strikethrough. Create/duplicate → soft-glow border to suggest
  // "becoming". Pending → accept/reject affordance.
  const variantClass =
    isFailed ? "border-destructive/40 bg-destructive/5" :
    isPending ? "border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/20" :
    isDelete ? "border-destructive/30 bg-destructive/5 opacity-70" :
    "border-primary/40 bg-primary/5";

  const titleClass = isDelete ? "line-through text-muted-foreground" : "";

  return (
    <Card
      className={`group relative flex flex-col h-full transition-all ${variantClass}`}
      data-testid="persona-ghost-card"
      data-call-id={ghost.callId}
      data-op={ghost.op}
      data-state={ghost.state}
      role="status"
      aria-live="polite"
      aria-label={`${ghost.op} ${name} (${ghost.state})`}
    >
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <GhostIcon op={ghost.op} state={ghost.state} />
              <CardTitle className={`text-lg truncate ${titleClass}`}>
                {name}
              </CardTitle>
              <GhostStatusBadge state={ghost.state} op={ghost.op} />
            </div>
            {isFailed && ghost.error && (
              <div className="flex items-start gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{ghost.error}</span>
              </div>
            )}
          </div>

          {isPending && (
            <div className="flex flex-wrap gap-2 items-center" data-action-button>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-8"
                onClick={() => ack(ghost.callId, true)}
              >
                <Check className="mr-1 h-3.5 w-3.5" />
                Accept
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => ack(ghost.callId, false)}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Reject
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      {((ghost.partial as PersonaRow).description || ghost.before?.description) && (
        <CardContent className="pt-0">
          <p className={`text-sm text-muted-foreground line-clamp-2 ${titleClass}`}>
            {(ghost.partial as PersonaRow).description || ghost.before?.description}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

function GhostIcon({ op, state }: { op: Ghost<PersonaRow>["op"]; state: Ghost<PersonaRow>["state"] }) {
  if (state === "creating" || state === "duplicating" || state === "updating" || state === "deleting") {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />;
  }
  if (op === "delete") return <Trash2 className="h-4 w-4 text-destructive flex-shrink-0" />;
  return <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />;
}

function GhostStatusBadge({
  state,
  op,
}: {
  state: Ghost<PersonaRow>["state"];
  op: Ghost<PersonaRow>["op"];
}) {
  switch (state) {
    case "creating":
      return <Badge variant="secondary">Creating…</Badge>;
    case "duplicating":
      return <Badge variant="secondary">Duplicating…</Badge>;
    case "updating":
      return <Badge variant="secondary">Updating…</Badge>;
    case "deleting":
      return <Badge variant="secondary">Deleting…</Badge>;
    case "pending":
      return <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">Pending</Badge>;
    case "accepted":
      return <Badge variant="default">Accepted</Badge>;
    case "rejected":
      return <Badge variant="outline">Rejected</Badge>;
    case "committed":
      return <Badge variant="default">{op === "delete" ? "Deleted" : "Done"}</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
  }
}
