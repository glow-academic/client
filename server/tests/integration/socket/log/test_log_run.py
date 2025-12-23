"""Integration tests for log_run WebSocket event."""

import uuid

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)

from app.socket.v3.log import log_run, log_run_internal

pytestmark = pytest.mark.asyncio


async def test_log_run_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful log_run event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)
    
    # Create a run first using proper SQL helper
    from utils.sql_helper import load_sql
    
    # Get or create required entities
    model_id = await db.fetchval("SELECT id FROM models LIMIT 1")
    if not model_id:
        model_id = await db.fetchval(
            "INSERT INTO models(name, provider, model_name, active) "
            "VALUES ('Test Model', 'openai', 'gpt-4', true) RETURNING id"
        )
    agent_id = await db.fetchval("SELECT id FROM agents LIMIT 1")
    if not agent_id:
        agent_id = await db.fetchval(
            "INSERT INTO agents(name, active) VALUES ('Test Agent', true) RETURNING id"
        )
    
    sql_create_run = load_sql("app/sql/v3/model_runs/create_model_run_complete.sql")
    run_row = await db.fetchrow(
        sql_create_run, department_id, model_id_str, None, "persona", profile_id, None, agent_id
    )
    run_id = run_row["run_id"] if run_row else None
    assert run_id is not None

    sid = "test_sid_123"
    data = {
        "runId": run_id,
        "operationType": "simulation",
        "inputTextTokens": 100,
        "outputTextTokens": 50,
        "departmentId": str(department_id),
        "systemPrompt": "Test system prompt",
        "assistantOutput": "Test output",
    }

    # Act
    await log_run(sid, data)

    # Assert - verify run was updated in database
    run_row = await db.fetchrow(
        "SELECT * FROM runs WHERE id = $1", run_id
    )
    assert run_row is not None
    assert run_row["input_tokens"] == 100
    assert run_row["output_tokens"] == 50


async def test_log_run_internal_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful log_run internal event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)
    
    # Create a run first using proper SQL helper
    from utils.sql_helper import load_sql
    
    # Get or create required entities
    model_id = await db.fetchval("SELECT id FROM models LIMIT 1")
    if not model_id:
        model_id = await db.fetchval(
            "INSERT INTO models(name, provider, model_name, active) "
            "VALUES ('Test Model', 'openai', 'gpt-4', true) RETURNING id"
        )
    agent_id = await db.fetchval("SELECT id FROM agents LIMIT 1")
    if not agent_id:
        agent_id = await db.fetchval(
            "INSERT INTO agents(name, active) VALUES ('Test Agent', true) RETURNING id"
        )
    
    sql_create_run = load_sql("app/sql/v3/model_runs/create_model_run_complete.sql")
    run_row = await db.fetchrow(
        sql_create_run, department_id, model_id_str, None, "persona", profile_id, None, agent_id
    )
    run_id = run_row["run_id"] if run_row else None
    assert run_id is not None

    data = {
        "runId": run_id,
        "operationType": "simulation",
        "inputTextTokens": 200,
        "outputTextTokens": 100,
        "departmentId": str(department_id),
    }

    # Act
    await log_run_internal(data)

    # Assert - verify run was updated in database
    run_row = await db.fetchrow(
        "SELECT * FROM runs WHERE id = $1", run_id
    )
    assert run_row is not None
    assert run_row["input_tokens"] == 200
    assert run_row["output_tokens"] == 100


async def test_log_run_with_developer_messages(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test log_run with developer messages in inputItems."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)
    
    # Create a run first using proper SQL helper
    from utils.sql_helper import load_sql
    
    # Get or create required entities
    model_id = await db.fetchval("SELECT id FROM models LIMIT 1")
    if not model_id:
        model_id = await db.fetchval(
            "INSERT INTO models(name, provider, model_name, active) "
            "VALUES ('Test Model', 'openai', 'gpt-4', true) RETURNING id"
        )
    agent_id = await db.fetchval("SELECT id FROM agents LIMIT 1")
    if not agent_id:
        agent_id = await db.fetchval(
            "INSERT INTO agents(name, active) VALUES ('Test Agent', true) RETURNING id"
        )
    
    sql_create_run = load_sql("app/sql/v3/model_runs/create_model_run_complete.sql")
    run_row = await db.fetchrow(
        sql_create_run, department_id, model_id_str, None, "persona", profile_id, None, agent_id
    )
    run_id = run_row["run_id"] if run_row else None
    assert run_id is not None

    sid = "test_sid_123"
    data = {
        "runId": run_id,
        "operationType": "simulation",
        "inputTextTokens": 100,
        "outputTextTokens": 50,
        "departmentId": str(department_id),
        "inputItems": [
            {"role": "developer", "content": "Test developer message"},
            {"role": "user", "content": "Test user message"},
        ],
    }

    # Act
    await log_run(sid, data)

    # Assert - verify developer messages were saved
    dev_messages = await db.fetch(
        "SELECT content FROM model_run_developer_messages WHERE run_id = $1",
        run_id,
    )
    assert len(dev_messages) == 1
    assert dev_messages[0]["content"] == "Test developer message"


async def test_log_run_validation_error(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test log_run with invalid payload."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "runId": "invalid-uuid",
        "operationType": "simulation",
        # Missing required fields
    }

    # Act
    await log_run(sid, data)

    # Assert - should handle validation error gracefully
    # The handler logs the error but doesn't raise
    # No database changes expected


async def test_log_run_missing_run_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test log_run with missing runId."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "operationType": "simulation",
        "inputTextTokens": 100,
        "outputTextTokens": 50,
    }

    # Act
    await log_run(sid, data)

    # Assert - should handle missing runId gracefully
    # Validation error should be logged but not raise

