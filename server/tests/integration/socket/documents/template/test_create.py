"""Integration tests for document_template_create internal event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)

from app.socket.v3.simulations.document_template_create import (
    _document_template_create_impl,
    document_template_create_internal,
)

pytestmark = pytest.mark.asyncio


async def test_document_template_create_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful document_template_create event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    # Create document
    document_id = await db.fetchval(
        "INSERT INTO documents(title, department_id, profile_id, active) VALUES ('Test Document', $1, $2, true) RETURNING id",
        department_id,
        profile_id,
    )

    # Create run
    run_id = await db.fetchval(
        "INSERT INTO runs(input_tokens, output_tokens) VALUES (0, 0) RETURNING id"
    )

    template_html = "<html><body>Test Template</body></html>"
    template_schema = {"fields": [{"name": "title", "type": "text"}]}

    # Act
    result = await _document_template_create_impl(
        document_id,
        "Test Document",
        template_html,
        template_schema,
        run_id,
        "test_sid_123",
        "test_room",
    )

    # Assert - verify template was created
    assert result is not None
    assert result["upload_id"] is not None

    # Verify template was linked to document
    template_row = await db.fetchrow(
        "SELECT dt.* FROM document_templates dt WHERE dt.document_id = $1",
        document_id,
    )
    assert template_row is not None

    # Verify event was emitted
    events = mock_sio.get_events("documents_template_generation_complete")
    assert len(events) == 1
    assert events[0]["success"] is True


async def test_document_template_create_internal_event(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test document_template_create via internal event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    document_id = await db.fetchval(
        "INSERT INTO documents(title, department_id, profile_id, active) VALUES ('Test Document', $1, $2, true) RETURNING id",
        department_id,
        profile_id,
    )
    run_id = await db.fetchval(
        "INSERT INTO runs(input_tokens, output_tokens) VALUES (0, 0) RETURNING id"
    )

    data = {
        "document_id": str(document_id),
        "document_name": "Test Document",
        "template_html": "<html><body>Test</body></html>",
        "template_schema": {"fields": []},
        "run_id": str(run_id),
        "sid": "test_sid_123",
        "room": "test_room",
    }

    # Act
    await document_template_create_internal(data)

    # Assert - verify template was created
    template_row = await db.fetchrow(
        "SELECT * FROM document_templates WHERE document_id = $1",
        document_id,
    )
    assert template_row is not None


async def test_document_template_create_without_document_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test document_template_create without document_id (just creates upload)."""
    # Arrange
    run_id = await db.fetchval(
        "INSERT INTO runs(input_tokens, output_tokens) VALUES (0, 0) RETURNING id"
    )

    template_html = "<html><body>Test Template</body></html>"
    template_schema = {"fields": []}

    # Act
    result = await _document_template_create_impl(
        None,
        None,
        template_html,
        template_schema,
        run_id,
        "test_sid_123",
        None,
    )

    # Assert - verify upload was created
    assert result is not None
    assert result["upload_id"] is not None

