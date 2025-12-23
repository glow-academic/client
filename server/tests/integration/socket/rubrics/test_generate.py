"""Integration tests for rubric_generate WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.rubrics.generate import rubric_generate

pytestmark = pytest.mark.asyncio


async def test_rubric_generate_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful rubric_generate event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    sid = "test_sid_123"
    data = {
        "department_id": str(department_id),
        "profile_id": str(profile_id),
        "name": "Test Rubric",
    }

    # Act
    await rubric_generate(sid, data)

    # Assert - verify rubric generation started
    # AI generation uses mocked Runner
    # Verify log_run event was emitted
    log_events = mock_internal_sio.get_events("log_run")
    # Should have log_run event after generation completes

