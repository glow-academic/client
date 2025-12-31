"""Route tests for POST /api/v4/personas/detail endpoint."""

from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestPersonaSqlParams,
    CreateTestPersonaSqlRow,
    GetPersonaByIdSqlParams,
    GetPersonaByIdSqlRow,
)
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_get_persona_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting persona detail."""
    await get_superadmin_alias(db)

    # Create a persona using SQL file
    persona_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/personas/test_create_test_persona_v4_complete.sql",
        params=CreateTestPersonaSqlParams(
            persona_name="Test Persona",
            description="Test Description",
            color="#3B82F6",
            icon="Brain",
            active=True,
        ),
    )
    typed_persona = CreateTestPersonaSqlRow.model_validate(persona_result.model_dump())
    assert typed_persona.persona_id is not None
    persona_id = typed_persona.persona_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/personas/detail",
        json={"personaId": str(persona_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["name"] == "Test Persona"
    assert data["description"] == "Test Description"
    assert data["active"] is True
    assert data["color"] == "#3B82F6"
    assert data["icon"] == "Brain"
    assert "can_edit" in data
    assert "can_duplicate" in data
    assert "can_delete" in data


async def test_get_persona_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting persona detail for non-existent persona."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/personas/detail",
        json={"personaId": "00000000-0000-0000-0000-000000000000"},
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()

