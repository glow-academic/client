"""In-memory run context cache for attempt streaming.

Caches run_id -> {chat_id, message_id, tool_meta} so that progress events
can look up the chat/message context and resolve tool argument names
without a DB query per delta.

Populated in message.py (before generate_artifact), cleaned up in
complete.py and error.py.
"""

from dataclasses import dataclass, field

_run_contexts: dict[str, "RunContext"] = {}

# Target display columns per entry type. These are the fixed column names
# in the database tables — what's configurable is the tool *argument* name
# that maps to each column via the output schema.
ENTRY_TYPE_DISPLAY_COLUMNS: dict[str, str] = {
    "contents": "content",  # simulation_contents_entry.content
    "hints": "hint",  # simulation_hints_entry.hint
}


@dataclass(frozen=True, slots=True)
class ToolStreamingMeta:
    """Metadata for resolving a tool's streaming output.

    entry_type: Which entry table this tool writes to (e.g. "contents", "hints")
    display_arg: The tool argument name whose value should be streamed
                 (resolved via output schema: arg → Jinja template → column)
    """

    entry_type: str
    display_arg: str | None


@dataclass(frozen=True, slots=True)
class RunContext:
    chat_id: str
    message_id: str
    tool_meta: dict[str, ToolStreamingMeta] = field(default_factory=dict)


def set_run_context(
    run_id: str,
    chat_id: str,
    message_id: str,
    tool_meta: dict[str, ToolStreamingMeta] | None = None,
) -> None:
    """Cache run context when a run is created."""
    _run_contexts[run_id] = RunContext(
        chat_id=chat_id,
        message_id=message_id,
        tool_meta=tool_meta or {},
    )


def get_run_context(run_id: str) -> RunContext | None:
    """Look up cached run context (zero DB cost)."""
    return _run_contexts.get(run_id)


def remove_run_context(run_id: str | None) -> None:
    """Remove cached run context after completion or error."""
    if run_id:
        _run_contexts.pop(run_id, None)
