"""Session store for audio generation - tracks queues and WebSocket connections."""

import asyncio
from typing import Any

# Global session store: sid or group_id -> session data
_session_store: dict[str, dict[str, Any]] = {}


class AudioSession:
    """Audio session data structure.

    Sessions are keyed by group_id (the conversation/session container).
    Individual generations within a session use run_id.
    """

    def __init__(self, sid: str, group_id: str):
        self.sid = sid
        self.group_id = group_id
        self.inbound_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self.outbound_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self.muted = False
        self.oa_ws_connection: Any | None = None  # OpenAI WebSocket connection
        self.item_id_to_upload_id: dict[str, str] = {}  # item_id -> upload_id mapping
        self.response_id_to_upload_id: dict[
            str, str
        ] = {}  # response_id -> upload_id mapping
        self.run_id: str | None = None  # Current generation run_id (if any)


def get_session(session_key: str) -> AudioSession | None:
    """Get session by sid or group_id."""
    session_data = _session_store.get(session_key)
    if session_data:
        return session_data.get("session")
    return None


def create_session(sid: str, group_id: str) -> AudioSession:
    """Create a new audio session."""
    session = AudioSession(sid, group_id)
    # Store by both sid and group_id for easy lookup
    _session_store[sid] = {"session": session, "group_id": group_id}
    _session_store[group_id] = {"session": session, "sid": sid}
    return session


def remove_session(session_key: str) -> None:
    """Remove session by sid or group_id."""
    session_data = _session_store.get(session_key)
    if session_data:
        session = session_data.get("session")
        if session:
            # Remove from both keys
            _session_store.pop(session.sid, None)
            _session_store.pop(session.group_id, None)


def get_session_by_sid(sid: str) -> AudioSession | None:
    """Get session by socket ID."""
    return get_session(sid)


def get_session_by_group_id(group_id: str) -> AudioSession | None:
    """Get session by group ID."""
    return get_session(group_id)
