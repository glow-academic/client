"""In-memory run context cache for attempt streaming.

Caches run_id -> {chat_id, message_id} so that progress events
can look up the chat/message context without a DB query per delta.

Tool argument resolution is now handled natively by generate.py
via resolved_fields (populated from args_outputs_resource templates).

Populated in message.py (before generate_artifact), cleaned up in
complete.py and error.py.
"""

from dataclasses import dataclass

_run_contexts: dict[str, "RunContext"] = {}


@dataclass(frozen=True, slots=True)
class RunContext:
    chat_id: str
    message_id: str


def set_run_context(
    run_id: str,
    chat_id: str,
    message_id: str,
) -> None:
    """Cache run context when a run is created."""
    _run_contexts[run_id] = RunContext(
        chat_id=chat_id,
        message_id=message_id,
    )


def get_run_context(run_id: str) -> RunContext | None:
    """Look up cached run context (zero DB cost)."""
    return _run_contexts.get(run_id)


def remove_run_context(run_id: str | None) -> None:
    """Remove cached run context after completion or error."""
    if run_id:
        _run_contexts.pop(run_id, None)
