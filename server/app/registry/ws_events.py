"""WebSocket event registry: input → output event mapping.

For each (artifact, operation) input event, defines the set of output
events that can be emitted. This is the single source of truth for
the ws event contract between client and server.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# (artifact, operation) → list of output events
# ---------------------------------------------------------------------------

WS_EVENTS: dict[tuple[str, str], list[str]] = {
    ("persona", "get"): [
        "persona.get.started",
        "persona.get.progress",
        "persona.get.completed",
        "persona.get.failed",
    ],
    ("persona", "create"): [
        "persona.create.started",
        "persona.create.progress",
        "persona.create.completed",
        "persona.create.failed",
    ],
    ("persona", "update"): [
        "persona.update.started",
        "persona.update.progress",
        "persona.update.completed",
        "persona.update.failed",
    ],
    ("persona", "delete"): [
        "persona.delete.started",
        "persona.delete.progress",
        "persona.delete.completed",
        "persona.delete.failed",
    ],
    ("persona", "duplicate"): [
        "persona.duplicate.started",
        "persona.duplicate.progress",
        "persona.duplicate.completed",
        "persona.duplicate.failed",
    ],
    ("persona", "draft"): [
        "persona.draft.started",
        "persona.draft.progress",
        "persona.draft.completed",
        "persona.draft.failed",
    ],
    ("persona", "search"): [
        "persona.search.started",
        "persona.search.progress",
        "persona.search.completed",
        "persona.search.failed",
    ],
    ("persona", "drafts"): [
        "persona.drafts.started",
        "persona.drafts.progress",
        "persona.drafts.completed",
        "persona.drafts.failed",
    ],
    ("persona", "docs"): [
        "persona.docs.started",
        "persona.docs.progress",
        "persona.docs.completed",
        "persona.docs.failed",
    ],
    ("persona", "export"): [
        "persona.export.started",
        "persona.export.progress",
        "persona.export.completed",
        "persona.export.failed",
    ],
    ("persona", "refresh"): [
        "persona.refresh.started",
        "persona.refresh.progress",
        "persona.refresh.completed",
        "persona.refresh.failed",
    ],
    # -----------------------------------------------------------------------
    # attempt — CRUD operations (canonical lifecycle)
    # -----------------------------------------------------------------------
    ("attempt", "get"): [
        "attempt.get.started",
        "attempt.get.progress",
        "attempt.get.completed",
        "attempt.get.failed",
    ],
    ("attempt", "search"): [
        "attempt.search.started",
        "attempt.search.progress",
        "attempt.search.completed",
        "attempt.search.failed",
    ],
    ("attempt", "docs"): [
        "attempt.docs.started",
        "attempt.docs.progress",
        "attempt.docs.completed",
        "attempt.docs.failed",
    ],
    ("attempt", "export"): [
        "attempt.export.started",
        "attempt.export.progress",
        "attempt.export.completed",
        "attempt.export.failed",
    ],
    ("attempt", "refresh"): [
        "attempt.refresh.started",
        "attempt.refresh.progress",
        "attempt.refresh.completed",
        "attempt.refresh.failed",
    ],
    # -----------------------------------------------------------------------
    # attempt — orchestration operations (domain-specific output events)
    # -----------------------------------------------------------------------
    ("attempt", "start"): [
        "attempt.started",
        "attempt.chat_started",
        "attempt.joined",
        "attempt.user_start",
        "attempt.user_progress",
        "attempt.user_complete",
        "attempt.assistant_start",
        "attempt.assistant_progress",
        "attempt.assistant_complete",
        "attempt.assistant_hints",
        "attempt.audio_ready",
        "attempt.audio_ended",
        "attempt.error",
    ],
    ("attempt", "next"): [
        "attempt.started",
        "attempt.chat_started",
        "attempt.ended",
        "attempt.user_start",
        "attempt.user_progress",
        "attempt.user_complete",
        "attempt.assistant_start",
        "attempt.assistant_progress",
        "attempt.assistant_complete",
        "attempt.assistant_hints",
        "attempt.audio_ready",
        "attempt.audio_ended",
        "attempt.error",
    ],
    ("attempt", "end"): [
        "attempt.ended",
        "attempt.chat_ended",
        "attempt.chat_started",
        "attempt.grade_start",
        "attempt.grade_progress",
        "attempt.grade_complete",
        "attempt.assistant_start",
        "attempt.assistant_progress",
        "attempt.assistant_complete",
        "attempt.assistant_hints",
        "attempt.audio_ready",
        "attempt.audio_ended",
        "attempt.error",
    ],
    ("attempt", "end_all"): [
        "attempt.ended",
        "attempt.chat_started",
        "attempt.assistant_start",
        "attempt.assistant_progress",
        "attempt.assistant_complete",
        "attempt.assistant_hints",
        "attempt.audio_ready",
        "attempt.audio_ended",
        "attempt.error",
    ],
    ("attempt", "message"): [
        "attempt.user_start",
        "attempt.user_progress",
        "attempt.user_complete",
        "attempt.assistant_start",
        "attempt.assistant_progress",
        "attempt.assistant_complete",
        "attempt.assistant_hints",
        "attempt.audio_ready",
        "attempt.audio_ended",
        "attempt.error",
    ],
    ("attempt", "stop"): [
        "attempt.stopped",
        "attempt.error",
    ],
    ("attempt", "response"): [
        "attempt.response_result",
        "attempt.error",
    ],
    ("attempt", "grade"): [
        "attempt.grade_start",
        "attempt.grade_progress",
        "attempt.grade_complete",
        "attempt.error",
    ],
    ("attempt", "use_previous"): [
        "attempt.started",
        "attempt.chat_started",
        "attempt.ended",
        "attempt.assistant_start",
        "attempt.assistant_progress",
        "attempt.assistant_complete",
        "attempt.assistant_hints",
        "attempt.audio_ready",
        "attempt.audio_ended",
        "attempt.error",
    ],
}
