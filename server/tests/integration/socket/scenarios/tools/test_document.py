"""Integration tests for scenario_tool_document WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)

from app.socket.v3.scenarios.tools.document import (
    _scenario_tool_document_impl,
    scenario_tool_document,
    scenario_tool_document_internal,
)

pytestmark = pytest.mark.asyncio


async def test_scenario_tool_document_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful scenario_tool_document event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    classify_agent_id = await db.fetchval(
        "INSERT INTO agents(name, active) VALUES ('Classify Agent', true) RETURNING id"
    )
    document_agent_id = await db.fetchval(
        "INSERT INTO agents(name, active) VALUES ('Document Agent', true) RETURNING id"
    )

    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )

    # Create parent document
    parent_document_id = await db.fetchval(
        "INSERT INTO documents(title, department_id, profile_id, active) VALUES ('Parent Document', $1, $2, true) RETURNING id",
        department_id,
        profile_id,
    )

    # Create upload
    upload_id = await db.fetchval(
        "INSERT INTO uploads(file_path, mime_type, file_size) VALUES ('test.pdf', 'application/pdf', 1024) RETURNING id"
    )

    sid = "test_sid_123"
    data = {
        "trace_id": "test-trace-id",
        "parent_document_id": str(parent_document_id),
        "file_path": "test.pdf",
        "mime_type": "application/pdf",
        "file_size": 1024,
        "child_name": "Child Document",
        "child_description": "A child document",
        "classify_agent_id": str(classify_agent_id),
        "document_agent_id": str(document_agent_id),
        "scenario_id": str(scenario_id),
    }

    # Act
    await scenario_tool_document(sid, data)

    # Assert - verify document was created
    child_doc = await db.fetchrow(
        "SELECT * FROM documents WHERE title = $1 AND parent_document_id = $2",
        "Child Document",
        parent_document_id,
    )
    assert child_doc is not None

    # Verify event was emitted
    events = mock_sio.get_events("scenarios_tools_document_complete")
    assert len(events) == 1
    assert events[0]["success"] is True
    assert events[0]["trace_id"] == "test-trace-id"
    assert events[0]["parent_document_id"] == str(parent_document_id)


async def test_scenario_tool_document_internal_event(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test scenario_tool_document via internal event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    classify_agent_id = await db.fetchval(
        "INSERT INTO agents(name, active) VALUES ('Classify Agent', true) RETURNING id"
    )
    document_agent_id = await db.fetchval(
        "INSERT INTO agents(name, active) VALUES ('Document Agent', true) RETURNING id"
    )

    parent_document_id = await db.fetchval(
        "INSERT INTO documents(title, department_id, profile_id, active) VALUES ('Parent Document', $1, $2, true) RETURNING id",
        department_id,
        profile_id,
    )

    data = {
        "sid": "test_sid_123",
        "trace_id": "test-trace-id",
        "parent_document_id": str(parent_document_id),
        "file_path": "test.pdf",
        "mime_type": "application/pdf",
        "file_size": 1024,
        "child_name": "Child Document",
        "child_description": "A child document",
        "classify_agent_id": str(classify_agent_id),
        "document_agent_id": str(document_agent_id),
    }

    # Act
    await scenario_tool_document_internal(data)

    # Assert - verify document was created
    child_doc = await db.fetchrow(
        "SELECT * FROM documents WHERE title = $1",
        "Child Document",
    )
    assert child_doc is not None


async def test_scenario_tool_document_missing_trace_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test scenario_tool_document with missing trace_id."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    classify_agent_id = await db.fetchval(
        "INSERT INTO agents(name, active) VALUES ('Classify Agent', true) RETURNING id"
    )
    document_agent_id = await db.fetchval(
        "INSERT INTO agents(name, active) VALUES ('Document Agent', true) RETURNING id"
    )

    parent_document_id = await db.fetchval(
        "INSERT INTO documents(title, department_id, profile_id, active) VALUES ('Parent Document', $1, $2, true) RETURNING id",
        department_id,
        profile_id,
    )

    sid = "test_sid_123"
    data = {
        "parent_document_id": str(parent_document_id),
        "file_path": "test.pdf",
        "mime_type": "application/pdf",
        "file_size": 1024,
        "child_name": "Child Document",
        "child_description": "A child document",
        "classify_agent_id": str(classify_agent_id),
        "document_agent_id": str(document_agent_id),
    }

    # Act
    await scenario_tool_document(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("scenarios_tools_document_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False

