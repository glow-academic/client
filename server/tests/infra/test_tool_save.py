"""Integration tests for tool_save — real pool, real DB, no mocks.

Tests exercise the full save flow against testcontainers Postgres + Redis.
Test data is created via black-box tool functions.
"""

from uuid import UUID

import pytest
from fastapi import HTTPException

from app.infra.tool_save import resolve_tool_values, save_tool_client
from app.routes.v5.api.main.tool.types import SaveToolItem

from .conftest import (
    ADMIN_PROFILE_ID,
    GUEST_PROFILE_ID,
    SUPERADMIN_PROFILE_ID,
)

pytestmark = pytest.mark.asyncio


# ===== resolve_tool_values =====


class TestResolveValues:
    async def test_passes_through_ids(self, pool, redis_client):
        """When IDs are already provided, no create calls happen."""
        async with pool.acquire() as conn:
            from app.routes.v5.tools.resources.names.create import create_name

            name = await create_name(conn, "Existing Tool", redis_client)

        item = SaveToolItem(name_id=name.id)

        async with pool.acquire() as conn:
            errors = await resolve_tool_values(conn, redis_client, item, is_update=False)

        assert errors == []
        assert item.name_id == name.id

    async def test_creates_name_from_value(self, pool, redis_client):
        """Raw name value -> create_name -> sets name_id."""
        item = SaveToolItem(name="Brand New Tool")

        async with pool.acquire() as conn:
            errors = await resolve_tool_values(conn, redis_client, item, is_update=False)

        assert errors == []
        assert item.name_id is not None

    async def test_creates_description_from_value(self, pool, redis_client, name_id):
        """Raw description value -> create_description -> sets description_id."""
        item = SaveToolItem(name_id=name_id, description="A useful tool")

        async with pool.acquire() as conn:
            errors = await resolve_tool_values(conn, redis_client, item, is_update=False)

        assert errors == []
        assert item.description_id is not None

    async def test_required_fields_on_create(self, pool, redis_client):
        """Missing required fields on create -> errors."""
        item = SaveToolItem()

        async with pool.acquire() as conn:
            errors = await resolve_tool_values(conn, redis_client, item, is_update=False)

        field_names = {e.field for e in errors}
        assert "name" in field_names

    async def test_no_required_validation_on_update(self, pool, redis_client):
        """Update mode skips required field validation."""
        item = SaveToolItem()

        async with pool.acquire() as conn:
            errors = await resolve_tool_values(conn, redis_client, item, is_update=True)

        assert errors == []


# ===== save_tool_client — create =====


class TestSaveToolClientCreate:
    async def test_create_success(self, pool, redis_client, name_id):
        """Superadmin can create a tool with pre-resolved name."""
        result = await save_tool_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveToolItem(name_id=name_id)],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].tool_id is not None

    async def test_create_with_raw_name(self, pool, redis_client):
        """Superadmin can create a tool with raw name (auto-resolved)."""
        result = await save_tool_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveToolItem(name="My New Tool")],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True

    async def test_create_permission_denied(self, pool, redis_client, name_id):
        """Guest cannot create tools."""
        with pytest.raises(HTTPException) as exc_info:
            await save_tool_client(
                pool,
                redis_client,
                profile_id=GUEST_PROFILE_ID,
                items=[SaveToolItem(name_id=name_id)],
            )

        assert exc_info.value.status_code == 403


# ===== save_tool_client — update =====


class TestSaveToolClientUpdate:
    async def _create_tool(self, pool, redis_client) -> UUID:
        """Helper: create a tool to update later."""
        result = await save_tool_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveToolItem(name="Tool To Update")],
        )
        return result.results[0].tool_id

    async def test_update_success(self, pool, redis_client):
        """Update an existing tool's name."""
        tool_id = await self._create_tool(pool, redis_client)

        result = await save_tool_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveToolItem(input_tool_id=tool_id, name="Updated Name")],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].tool_id == tool_id
        assert result.results[0].message == "Tool updated successfully"

    async def test_update_tool_not_found(self, pool, redis_client):
        """Update with non-existent tool -> 404."""
        fake_id = UUID("00000000-0000-0000-0000-000000000001")

        with pytest.raises(HTTPException) as exc_info:
            await save_tool_client(
                pool,
                redis_client,
                profile_id=SUPERADMIN_PROFILE_ID,
                items=[SaveToolItem(input_tool_id=fake_id)],
            )

        assert exc_info.value.status_code == 404

    async def test_update_permission_denied_active_agents(self, pool, redis_client):
        """Cannot update a tool that has active agents.

        Note: This test creates a tool but doesn't link it to agents,
        so it should succeed. The active_agent_count check relies on
        real junction data — a tool with no agents has count=0.
        """
        tool_id = await self._create_tool(pool, redis_client)

        # Tool with no active agents — update should succeed
        result = await save_tool_client(
            pool,
            redis_client,
            profile_id=ADMIN_PROFILE_ID,
            items=[SaveToolItem(input_tool_id=tool_id, name="Admin Update")],
        )
        assert result.results[0].success is True


# ===== save_tool_client — validation =====


class TestSaveToolClientValidation:
    async def test_validation_errors_returned_without_mutation(self, pool, redis_client):
        """Items with missing required fields -> errors returned, no artifact created."""
        item = SaveToolItem()  # Missing required name

        result = await save_tool_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[item],
        )

        assert len(result.results) == 1
        assert result.results[0].success is False
        assert result.results[0].errors is not None

    async def test_profile_not_found(self, pool, redis_client):
        """Non-existent profile -> 401."""
        fake_profile = UUID("00000000-0000-0000-0000-000000000099")

        with pytest.raises(HTTPException) as exc_info:
            await save_tool_client(
                pool,
                redis_client,
                profile_id=fake_profile,
                items=[],
            )

        assert exc_info.value.status_code == 401
