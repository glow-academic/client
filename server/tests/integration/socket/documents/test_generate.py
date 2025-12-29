"""Integration tests for document_generate WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.documents.generate import document_generate

pytestmark = pytest.mark.asyncio


async def test_document_generate_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful document_generate event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    # Create document
    document_id = await db.fetchval(
        "INSERT INTO documents(title, department_id, profile_id, active) "
        "VALUES ('Test Document', $1, $2, true) RETURNING id",
        department_id,
        profile_id,
    )

    sid = "test_sid_123"
    data = {
        "documentId": str(document_id),
        "documentName": "Test Document",
    }

    # Act
    await document_generate(sid, data)

    # Assert - verify document generation started
    # AI generation uses mocked Runner
    # Verify log_run event was emitted
    log_events = mock_internal_sio.get_events("log_run")
    # Should have log_run event after generation completes
