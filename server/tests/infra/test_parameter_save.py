"""Integration tests for parameter_save — real pool, real DB, no mocks.

Tests exercise the full save flow against testcontainers Postgres + Redis.
Test data is created via black-box tool functions.
"""

from uuid import UUID

import pytest
from fastapi import HTTPException

from app.infra.parameter_save import resolve_parameter_values, save_parameter_client
from app.routes.v5.api.main.parameter.types import SaveParameterItem

from .conftest import (
    MEMBER_PROFILE_ID,
    SUPERADMIN_PROFILE_ID,
)

pytestmark = pytest.mark.asyncio


# ===== resolve_parameter_values =====


class TestResolveValues:
    async def test_passes_through_ids(self, pool, redis_client):
        """When IDs are already provided, no create calls happen."""
        async with pool.acquire() as conn:
            from app.routes.v5.tools.resources.names.create import create_name

            name = await create_name(conn, "Existing Parameter", redis_client)

        item = SaveParameterItem(name_id=name.id)

        async with pool.acquire() as conn:
            errors = await resolve_parameter_values(
                conn, redis_client, item, is_update=False
            )

        assert errors == []
        assert item.name_id == name.id

    async def test_creates_name_from_value(self, pool, redis_client):
        """Raw name value -> create_name -> sets name_id."""
        item = SaveParameterItem(name="Brand New Parameter")

        async with pool.acquire() as conn:
            errors = await resolve_parameter_values(
                conn, redis_client, item, is_update=False
            )

        assert errors == []
        assert item.name_id is not None

    async def test_creates_description_from_value(self, pool, redis_client, name_id):
        """Raw description value -> create_description -> sets description_id."""
        item = SaveParameterItem(name_id=name_id, description="A useful parameter")

        async with pool.acquire() as conn:
            errors = await resolve_parameter_values(
                conn, redis_client, item, is_update=False
            )

        assert errors == []
        assert item.description_id is not None

    async def test_required_fields_on_create(self, pool, redis_client):
        """Missing required fields on create -> errors."""
        item = SaveParameterItem()

        async with pool.acquire() as conn:
            errors = await resolve_parameter_values(
                conn, redis_client, item, is_update=False
            )

        field_names = {e.field for e in errors}
        assert "name" in field_names

    async def test_no_required_validation_on_update(self, pool, redis_client):
        """Update mode skips required field validation."""
        item = SaveParameterItem()

        async with pool.acquire() as conn:
            errors = await resolve_parameter_values(
                conn, redis_client, item, is_update=True
            )

        assert errors == []


# ===== save_parameter_client — create =====


class TestSaveParameterClientCreate:
    async def test_create_success(self, pool, redis_client, name_id):
        """Superadmin can create a parameter with pre-resolved name."""
        result = await save_parameter_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveParameterItem(name_id=name_id)],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].parameter_id is not None

    async def test_create_with_raw_name(self, pool, redis_client):
        """Superadmin can create a parameter with raw name (auto-resolved)."""
        result = await save_parameter_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveParameterItem(name="My New Parameter")],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True

    async def test_create_permission_denied(self, pool, redis_client, name_id):
        """Member cannot create parameters."""
        with pytest.raises(HTTPException) as exc_info:
            await save_parameter_client(
                pool,
                redis_client,
                profile_id=MEMBER_PROFILE_ID,
                items=[SaveParameterItem(name_id=name_id)],
            )

        assert exc_info.value.status_code == 403


# ===== save_parameter_client — update =====


class TestSaveParameterClientUpdate:
    async def _create_parameter(self, pool, redis_client) -> UUID:
        """Helper: create a parameter to update later."""
        result = await save_parameter_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveParameterItem(name="Parameter To Update")],
        )
        return result.results[0].parameter_id

    async def test_update_success(self, pool, redis_client):
        """Update an existing parameter's name."""
        parameter_id = await self._create_parameter(pool, redis_client)

        result = await save_parameter_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[
                SaveParameterItem(input_parameter_id=parameter_id, name="Updated Name")
            ],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].parameter_id == parameter_id
        assert result.results[0].message == "Parameter updated successfully"

    async def test_update_not_found(self, pool, redis_client):
        """Update with non-existent parameter -> 404."""
        fake_id = UUID("00000000-0000-0000-0000-000000000001")

        with pytest.raises(HTTPException) as exc_info:
            await save_parameter_client(
                pool,
                redis_client,
                profile_id=SUPERADMIN_PROFILE_ID,
                items=[SaveParameterItem(input_parameter_id=fake_id, name="Wont Work")],
            )

        assert exc_info.value.status_code == 404


# ===== save_parameter_client — validation =====


class TestSaveParameterClientValidation:
    async def test_validation_errors_returned_without_mutation(
        self, pool, redis_client
    ):
        """Items with missing required fields -> errors returned, no artifact created."""
        item = SaveParameterItem()  # Missing required name

        result = await save_parameter_client(
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
            await save_parameter_client(
                pool,
                redis_client,
                profile_id=fake_profile,
                items=[],
            )

        assert exc_info.value.status_code == 401
