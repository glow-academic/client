"""Integration tests for log_run WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.v4.helpers import (
    get_or_create_test_agent,
    get_or_create_test_department,
    get_or_create_test_model,
    get_or_create_test_profile,
)

from app.socket.v4.generate.log import log_run, log_run_internal

pytestmark = pytest.mark.asyncio


async def test_log_run_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful log_run event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)
    model_id = await get_or_create_test_model(db)
    agent_id = await get_or_create_test_agent(db)

    # Create a run first using SQL helper function
    from utils.sql_helper import execute_sql_typed

    from app.sql.types import TestCreateTestRunV4SqlParams

    params = TestCreateTestRunV4SqlParams(
        department_id=department_id,
        model_id=model_id,
        agent_id=agent_id,
        entity_type="agent",
        profile_id=profile_id,
    )
    run_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_create_test_run_v4_complete.sql",
        params=params,
    )
    run_id = str(run_result.run_id)

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
    from utils.sql_helper import execute_sql_typed

    from app.sql.types import (
        TestGetRunByIdV4SqlParams,
    )

    run_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_get_run_by_id_v4_complete.sql",
        params=TestGetRunByIdV4SqlParams(run_id=run_id),
    )
    assert run_result.input_tokens == 100
    assert run_result.output_tokens == 50


async def test_log_run_internal_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful log_run internal event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)
    model_id = await get_or_create_test_model(db)
    agent_id = await get_or_create_test_agent(db)

    # Create a run first using SQL helper function
    from utils.sql_helper import execute_sql_typed

    from app.sql.types import TestCreateTestRunV4SqlParams

    params = TestCreateTestRunV4SqlParams(
        department_id=department_id,
        model_id=model_id,
        agent_id=agent_id,
        entity_type="agent",
        profile_id=profile_id,
    )
    run_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_create_test_run_v4_complete.sql",
        params=params,
    )
    run_id = str(run_result.run_id)

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
    from utils.sql_helper import execute_sql_typed

    from app.sql.types import (
        TestGetRunByIdV4SqlParams,
    )

    run_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_get_run_by_id_v4_complete.sql",
        params=TestGetRunByIdV4SqlParams(run_id=run_id),
    )
    assert run_result.input_tokens == 200
    assert run_result.output_tokens == 100


async def test_log_run_with_developer_messages(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test log_run with developer messages in inputItems."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)
    model_id = await get_or_create_test_model(db)
    agent_id = await get_or_create_test_agent(db)

    # Create a run first using SQL helper function
    from utils.sql_helper import execute_sql_typed

    from app.sql.types import TestCreateTestRunV4SqlParams

    params = TestCreateTestRunV4SqlParams(
        department_id=department_id,
        model_id=model_id,
        agent_id=agent_id,
        entity_type="agent",
        profile_id=profile_id,
    )
    run_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_create_test_run_v4_complete.sql",
        params=params,
    )
    run_id = str(run_result.run_id)

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
    from utils.sql_helper import execute_sql_typed

    from app.sql.types import (
        TestGetDeveloperMessagesCountByRunV4SqlParams,
    )

    dev_messages_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_get_developer_messages_count_by_run_v4_complete.sql",
        params=TestGetDeveloperMessagesCountByRunV4SqlParams(run_id=run_id),
    )
    assert dev_messages_result.message_count >= 1


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
