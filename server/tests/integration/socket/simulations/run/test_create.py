"""Integration tests for simulation_run_create internal event."""

import uuid

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)

from app.socket.v3.simulations.run.create import (
    simulation_run_create_internal,
    _simulation_run_create_impl,
)

pytestmark = pytest.mark.asyncio


async def test_simulation_run_create_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_run_create internal event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    # Get or create required entities
    from tests.integration.socket.helpers import get_or_create_test_model
    
    model_id_str = await get_or_create_test_model(db)
    model_id = model_id_str

    persona_id = await db.fetchval("SELECT id FROM personas LIMIT 1")
    if not persona_id:
        persona_id = await db.fetchval(
            "INSERT INTO personas(name, active) VALUES ('Test Persona', true) RETURNING id"
        )

    agent_id = await db.fetchval("SELECT id FROM agents LIMIT 1")
    if not agent_id:
        agent_id = await db.fetchval(
            "INSERT INTO agents(name, active) VALUES ('Test Agent', true) RETURNING id"
        )

    data = {
        "department_id": str(department_id),
        "model_id": model_id_str,
        "persona_id": str(persona_id),
        "profile_id": str(profile_id),
        "agent_id": str(agent_id),
    }

    # Act
    await simulation_run_create_internal(data)

    # Assert - verify run was created in database
    run_row = await db.fetchrow(
        "SELECT * FROM model_runs WHERE department_id = $1 AND profile_id = $2 ORDER BY created_at DESC LIMIT 1",
        department_id,
        profile_id,
    )
    assert run_row is not None
    assert str(run_row["department_id"]) == str(department_id)
    assert str(run_row["profile_id"]) == str(profile_id)
    assert str(run_row["model_id"]) == str(model_id)
    assert str(run_row["persona_id"]) == str(persona_id)


async def test_simulation_run_create_impl_direct(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test _simulation_run_create_impl directly."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    model_id = await db.fetchval("SELECT id FROM models LIMIT 1")
    if not model_id:
        model_id = await db.fetchval(
            "INSERT INTO models(name, provider, model_name, active) "
            "VALUES ('Test Model', 'openai', 'gpt-4', true) RETURNING id"
        )

    persona_id = await db.fetchval("SELECT id FROM personas LIMIT 1")
    if not persona_id:
        persona_id = await db.fetchval(
            "INSERT INTO personas(name, active) VALUES ('Test Persona', true) RETURNING id"
        )

    agent_id = await db.fetchval("SELECT id FROM agents LIMIT 1")
    if not agent_id:
        agent_id = await db.fetchval(
            "INSERT INTO agents(name, active) VALUES ('Test Agent', true) RETURNING id"
        )

    # Act
    run_id = await _simulation_run_create_impl(
        uuid.UUID(str(department_id)),
        uuid.UUID(str(model_id)),
        uuid.UUID(str(persona_id)),
        uuid.UUID(str(profile_id)),
        uuid.UUID(str(agent_id)),
    )

    # Assert
    assert run_id is not None
    run_row = await db.fetchrow("SELECT * FROM model_runs WHERE id = $1", run_id)
    assert run_row is not None


async def test_simulation_run_create_validation_error(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_run_create with invalid payload."""
    # Arrange
    data = {
        "department_id": "invalid-uuid",
        # Missing required fields
    }

    # Act
    await simulation_run_create_internal(data)

    # Assert - should handle validation error gracefully
    # No database changes expected

