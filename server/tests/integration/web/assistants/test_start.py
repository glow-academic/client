"""Integration tests for start_assistant WebSocket event."""

import asyncpg  # type: ignore
import pytest
from app.socket.assistants.start import start_assistant
from tests.integration.web.conftest import MockSocketIO
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_start_assistant_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful assistant chat creation."""
    profile_id = await get_superadmin_alias(db)

    # Get a department_id for the profile
    dept_row = await db.fetchrow(
        "SELECT id FROM departments WHERE active = true LIMIT 1"
    )
    if not dept_row:
        pytest.skip("No active departments found in test database")
    department_id = str(dept_row["id"])

    sid = "test_sid_123"
    data = {
        "profile_id": profile_id,
        "initial_message": "Hello, I need help",
        "department_id": department_id,
    }

    await start_assistant(sid, data)

    # Verify events were emitted
    started_events = mock_sio.get_events("assistant_started")
    assert len(started_events) == 1
    assert started_events[0]["success"] is True
    assert "chat_id" in started_events[0]

    # Verify title_updated event was emitted
    title_events = mock_sio.get_events("title_updated")
    assert len(title_events) >= 1
    assert title_events[0]["chat_id"] == started_events[0]["chat_id"]

    # Verify chat was created in database
    chat_id = started_events[0]["chat_id"]
    chat_row = await db.fetchrow(
        "SELECT * FROM assistant_chats WHERE id = $1", chat_id
    )
    assert chat_row is not None
    assert chat_row["profile_id"] == profile_id


async def test_start_assistant_missing_profile_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test start_assistant with missing profile_id."""
    sid = "test_sid_123"
    data = {
        "initial_message": "Hello",
        "department_id": "test-dept-id",
    }

    await start_assistant(sid, data)

    # Verify error was emitted
    error_events = mock_sio.get_events("assistant_error")
    assert len(error_events) >= 1
    assert "Missing profile_id" in error_events[0]["message"]

    # Verify no chat was created
    started_events = mock_sio.get_events("assistant_started")
    assert len(started_events) == 0


async def test_start_assistant_missing_initial_message(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test start_assistant with missing initial_message."""
    profile_id = await get_superadmin_alias(db)
    sid = "test_sid_123"
    data = {
        "profile_id": profile_id,
        "department_id": "test-dept-id",
    }

    await start_assistant(sid, data)

    # Verify error was emitted
    error_events = mock_sio.get_events("assistant_error")
    assert len(error_events) >= 1
    assert "Missing profile_id or initial_message" in error_events[0]["message"]


async def test_start_assistant_missing_department_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test start_assistant with missing department_id."""
    profile_id = await get_superadmin_alias(db)
    sid = "test_sid_123"
    data = {
        "profile_id": profile_id,
        "initial_message": "Hello",
    }

    await start_assistant(sid, data)

    # Verify error was emitted
    error_events = mock_sio.get_events("assistant_error")
    assert len(error_events) >= 1
    assert "Missing department_id" in error_events[0]["message"]


async def test_start_assistant_profile_not_found(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test start_assistant with non-existent profile_id."""
    fake_profile_id = "00000000-0000-0000-0000-000000000000"

    dept_row = await db.fetchrow(
        "SELECT id FROM departments WHERE active = true LIMIT 1"
    )
    if not dept_row:
        pytest.skip("No active departments found in test database")
    department_id = str(dept_row["id"])

    sid = "test_sid_123"
    data = {
        "profile_id": fake_profile_id,
        "initial_message": "Hello",
        "department_id": department_id,
    }

    await start_assistant(sid, data)

    # Verify error was emitted
    error_events = mock_sio.get_events("assistant_error")
    assert len(error_events) >= 1
    assert "Profile not found" in error_events[0]["message"]

    # Verify no chat was created
    started_events = mock_sio.get_events("assistant_started")
    assert len(started_events) == 0

