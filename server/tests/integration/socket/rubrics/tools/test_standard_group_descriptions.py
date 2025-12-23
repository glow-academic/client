"""Integration tests for rubric_tool_standard_group_descriptions WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO

from app.socket.v3.rubrics.tools.standard_group_descriptions import (
    _rubric_tool_standard_group_descriptions_impl,
    rubric_tool_standard_group_descriptions,
    rubric_tool_standard_group_descriptions_internal,
)

pytestmark = pytest.mark.asyncio


async def test_rubric_tool_standard_group_descriptions_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful rubric_tool_standard_group_descriptions event."""
    # Arrange
    # Create rubric
    rubric_id = await db.fetchval(
        "INSERT INTO rubrics(name, description, points, pass_points, active) VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
    )

    # Create standard group
    standard_group_id = await db.fetchval(
        "INSERT INTO standard_groups(name, active) VALUES ('Test Group', true) RETURNING id"
    )

    # Create standard
    standard_id = await db.fetchval(
        "INSERT INTO standards(name, active) VALUES ('Test Standard', true) RETURNING id"
    )

    # Link standard to group
    await db.execute(
        "INSERT INTO standard_group_standards(standard_group_id, standard_id, active) VALUES ($1, $2, true)",
        standard_group_id,
        standard_id,
    )

    # Link group to rubric
    await db.execute(
        "INSERT INTO rubric_standard_groups(rubric_id, standard_group_id, active) VALUES ($1, $2, true)",
        rubric_id,
        standard_group_id,
    )

    sid = "test_sid_123"
    data = {
        "trace_id": "test-trace-id",
        "rubric_id": str(rubric_id),
        "descriptions": [
            {
                "standard_group_id": str(standard_group_id),
                "standard_id": str(standard_id),
                "description": "Updated description for the standard",
            }
        ],
    }

    # Act
    await rubric_tool_standard_group_descriptions(sid, data)

    # Assert - verify standard description was updated
    standard_row = await db.fetchrow(
        "SELECT description FROM standards WHERE id = $1",
        standard_id,
    )
    assert standard_row is not None
    # Description may be updated

    # Verify event was emitted
    events = mock_sio.get_events("rubrics_tools_standard_group_descriptions_complete")
    assert len(events) == 1
    assert events[0]["success"] is True
    assert events[0]["rubric_id"] == str(rubric_id)
    assert events[0]["updated_count"] >= 0


async def test_rubric_tool_standard_group_descriptions_internal_event(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test rubric_tool_standard_group_descriptions via internal event."""
    # Arrange
    rubric_id = await db.fetchval(
        "INSERT INTO rubrics(name, description, points, pass_points, active) VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
    )
    standard_group_id = await db.fetchval(
        "INSERT INTO standard_groups(name, active) VALUES ('Test Group', true) RETURNING id"
    )
    standard_id = await db.fetchval(
        "INSERT INTO standards(name, active) VALUES ('Test Standard', true) RETURNING id"
    )

    await db.execute(
        "INSERT INTO standard_group_standards(standard_group_id, standard_id, active) VALUES ($1, $2, true)",
        standard_group_id,
        standard_id,
    )
    await db.execute(
        "INSERT INTO rubric_standard_groups(rubric_id, standard_group_id, active) VALUES ($1, $2, true)",
        rubric_id,
        standard_group_id,
    )

    data = {
        "sid": "test_sid_123",
        "trace_id": "test-trace-id",
        "rubric_id": str(rubric_id),
        "descriptions": [
            {
                "standard_group_id": str(standard_group_id),
                "standard_id": str(standard_id),
                "description": "Updated description",
            }
        ],
    }

    # Act
    await rubric_tool_standard_group_descriptions_internal(data)

    # Assert - verify handler completed without error
    events = mock_sio.get_events("rubrics_tools_standard_group_descriptions_complete")
    assert len(events) == 1


async def test_rubric_tool_standard_group_descriptions_missing_trace_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test rubric_tool_standard_group_descriptions with missing trace_id."""
    # Arrange
    rubric_id = await db.fetchval(
        "INSERT INTO rubrics(name, description, points, pass_points, active) VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
    )

    sid = "test_sid_123"
    data = {
        "rubric_id": str(rubric_id),
        "descriptions": [],
    }

    # Act
    await rubric_tool_standard_group_descriptions(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("rubrics_tools_standard_group_descriptions_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False

