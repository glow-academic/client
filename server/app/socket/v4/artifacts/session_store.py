"""Session store for audio generation - tracks queues and WebSocket connections."""

import asyncio
from typing import Any

# Global session store: sid or run_id -> session data
_session_store: dict[str, dict[str, Any]] = {}


class AudioSession:
    """Audio session data structure."""

    def __init__(self, sid: str, run_id: str):
        self.sid = sid
        self.run_id = run_id
        self.inbound_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self.outbound_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self.muted = False
        self.oa_ws_connection: Any | None = None  # OpenAI WebSocket connection
        self.item_id_to_upload_id: dict[str, str] = {}  # item_id -> upload_id mapping
        self.response_id_to_upload_id: dict[
            str, str
        ] = {}  # response_id -> upload_id mapping
        self.group_id: str | None = None


def get_session(session_key: str) -> AudioSession | None:
    """Get session by sid or run_id."""
    session_data = _session_store.get(session_key)
    if session_data:
        return session_data.get("session")
    return None


def create_session(sid: str, run_id: str) -> AudioSession:
    """Create a new audio session."""
    session = AudioSession(sid, run_id)
    # Store by both sid and run_id for easy lookup
    _session_store[sid] = {"session": session, "run_id": run_id}
    _session_store[run_id] = {"session": session, "sid": sid}
    return session


def remove_session(session_key: str) -> None:
    """Remove session by sid or run_id."""
    session_data = _session_store.get(session_key)
    if session_data:
        session = session_data.get("session")
        if session:
            # Remove from both keys
            _session_store.pop(session.sid, None)
            _session_store.pop(session.run_id, None)


def get_session_by_sid(sid: str) -> AudioSession | None:
    """Get session by socket ID."""
    return get_session(sid)


def get_session_by_run_id(run_id: str) -> AudioSession | None:
    """Get session by run ID."""
    return get_session(run_id)
