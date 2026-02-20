"""Unified client payload types for v5 WebSocket generation.

Instead of per-artifact payload classes (GenerateAgentPayload, GenerateAuthPayload, …),
v5 uses a single GeneratePayload that carries the artifact_type discriminator and a
generic artifact_id field. The registry maps these to the correct fetcher kwarg.
"""

from uuid import UUID

from pydantic import BaseModel


class GeneratePayload(BaseModel):
    """Unified client-to-server payload for the `generate` WebSocket event.

    Fields:
        artifact_type: Registry key (e.g. "agent", "training", "auth").
        artifact_id:   Generic artifact ID — maps to agent_id, training_entry_id, etc.
        draft_id:      Optional draft ID (required for most artifacts).
        resource_types: Which resources to generate.
        user_instructions: Optional user instructions forwarded to LLM.
        save:          Whether to auto-save on completion.

        # Pass-through fields (training-specific, forwarded to internal emit)
        attempt_id:    Optional attempt context.
        training_department_id: Optional department context.
        staff_id:      Optional staff ID (profile artifact resolves to target_profile_id).
    """

    artifact_type: str
    artifact_id: UUID | None = None
    draft_id: UUID | None = None
    resource_types: list[str]
    user_instructions: list[str] | None = None
    save: bool = True

    # Pass-through context fields
    attempt_id: str | None = None
    training_department_id: str | None = None
    staff_id: str | None = None


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------


class ConnectionConfirmedPayload(BaseModel):
    """Server-to-client: connection confirmed."""

    sid: str
    profile_id: str | None
    guest_id: str | None
    server_time: float


# ---------------------------------------------------------------------------
# Attempt room management
# ---------------------------------------------------------------------------


class AttemptJoinPayload(BaseModel):
    """Client-to-server: join a chat room for real-time updates."""

    chat_id: UUID


class AttemptLeavePayload(BaseModel):
    """Client-to-server: leave a chat room."""

    chat_id: UUID


class AttemptJoinedEvent(BaseModel):
    """Server-to-client: successfully joined a chat room."""

    chat_id: str
    success: bool


# ---------------------------------------------------------------------------
# Test room management
# ---------------------------------------------------------------------------


class TestJoinPayload(BaseModel):
    """Client-to-server: join a test room for real-time updates."""

    invocation_id: UUID


class TestLeavePayload(BaseModel):
    """Client-to-server: leave a test room."""

    invocation_id: UUID


class TestJoinedEvent(BaseModel):
    """Server-to-client: successfully joined a test room."""

    invocation_id: str
    success: bool = True


class TestErrorEvent(BaseModel):
    """Server-to-client: test error."""

    invocation_id: str | None = None
    run_id: str | None = None
    message: str
    error_type: str | None = None


# ---------------------------------------------------------------------------
# Attempt state management
# ---------------------------------------------------------------------------


class AttemptStartPayload(BaseModel):
    """Client-to-server: start or proceed with an attempt.

    Dual-mode:
    - Create mode (no attempt_id): creates a new attempt, then generates first chat
    - Next mode (has attempt_id): checks remaining scenarios and proceeds or ends
    """

    training_entry_id: UUID | None = None
    attempt_id: UUID | None = None
    draft_id: UUID | None = None
    infinite_mode: bool = False
    resource_types: list[str] | None = None
    user_instructions: list[str] | None = None
    save: bool = True


class AttemptStartedEvent(BaseModel):
    """Server-to-client: new attempt created."""

    attempt_id: str
    training_entry_id: str


class AttemptEndPayload(BaseModel):
    """Client-to-server: end a single chat within an attempt."""

    attempt_id: UUID
    chat_id: UUID


class AttemptChatEndedEvent(BaseModel):
    """Server-to-client: single chat ended."""

    chat_id: str
    is_attempt_finished: bool | None = None
    grade_id: str | None = None


class AttemptEndAllPayload(BaseModel):
    """Client-to-server: end all remaining chats in an attempt."""

    attempt_id: UUID


class AttemptEndedEvent(BaseModel):
    """Server-to-client: entire attempt ended (all scenarios complete)."""

    attempt_id: str
    success: bool
    all_scenarios_complete: bool = False
    message: str | None = None


class AttemptUsePreviousPayload(BaseModel):
    """Client-to-server: copy grades from a previous attempt's chats.

    previous_chat_map: {scenario_id: previous_chat_id}
    """

    attempt_id: UUID
    previous_chat_map: dict[str, str]


class AttemptErrorEvent(BaseModel):
    """Server-to-client: attempt error."""

    chat_id: str | None = None
    type: str | None = None
    message: str
