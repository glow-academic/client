"""Integration tests for eval_save — real pool, real DB, no mocks.

Tests exercise the full save flow against testcontainers Postgres + Redis.
Test data is created via black-box tool functions.
"""

from uuid import UUID

import pytest
from fastapi import HTTPException

from app.infra.eval_save import resolve_eval_values, save_eval_client
from app.routes.v5.api.main.eval.types import SaveEvalItem

from .conftest import (
    ADMIN_PROFILE_ID,
    GUEST_PROFILE_ID,
    SUPERADMIN_PROFILE_ID,
)

pytestmark = pytest.mark.asyncio


# ===== resolve_eval_values =====


class TestResolveValues:
    async def test_passes_through_ids(self, pool, redis_client):
        """When IDs are already provided, no create calls happen."""
        async with pool.acquire() as conn:
            from app.routes.v5.tools.resources.names.create import create_name

            name = await create_name(conn, "Existing Eval", redis_client)

        item = SaveEvalItem(name_id=name.id)

        async with pool.acquire() as conn:
            errors = await resolve_eval_values(conn, redis_client, item, is_update=False)

        assert errors == []
        assert item.name_id == name.id

    async def test_creates_name_from_value(self, pool, redis_client):
        """Raw name value -> create_name -> sets name_id."""
        item = SaveEvalItem(name="Brand New Eval")

        async with pool.acquire() as conn:
            errors = await resolve_eval_values(conn, redis_client, item, is_update=False)

        assert errors == []
        assert item.name_id is not None

    async def test_creates_description_from_value(self, pool, redis_client, name_id):
        """Raw description value -> create_description -> sets description_id."""
        item = SaveEvalItem(name_id=name_id, description="A useful eval")

        async with pool.acquire() as conn:
            errors = await resolve_eval_values(conn, redis_client, item, is_update=False)

        assert errors == []
        assert item.description_id is not None

    async def test_required_fields_on_create(self, pool, redis_client):
        """Missing required fields on create -> errors."""
        item = SaveEvalItem()

        async with pool.acquire() as conn:
            errors = await resolve_eval_values(conn, redis_client, item, is_update=False)

        field_names = {e.field for e in errors}
        assert "name" in field_names

    async def test_required_fields_on_update(self, pool, redis_client):
        """Eval requires name even on update (no is_update gate)."""
        item = SaveEvalItem()

        async with pool.acquire() as conn:
            errors = await resolve_eval_values(conn, redis_client, item, is_update=True)

        # Eval's resolve doesn't gate required checks on is_update
        field_names = {e.field for e in errors}
        assert "name" in field_names


# ===== save_eval_client — create =====


class TestSaveEvalClientCreate:
    async def test_create_success(self, pool, redis_client, name_id):
        """Superadmin can create an eval with pre-resolved name."""
        result = await save_eval_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveEvalItem(name_id=name_id)],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].eval_id is not None

    async def test_create_with_raw_name(self, pool, redis_client):
        """Superadmin can create an eval with raw name (auto-resolved)."""
        result = await save_eval_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveEvalItem(name="My New Eval")],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True

    async def test_create_permission_denied(self, pool, redis_client, name_id):
        """Admin cannot create evals (only superadmin can)."""
        with pytest.raises(HTTPException) as exc_info:
            await save_eval_client(
                pool,
                redis_client,
                profile_id=ADMIN_PROFILE_ID,
                items=[SaveEvalItem(name_id=name_id)],
            )

        assert exc_info.value.status_code == 403


# ===== save_eval_client — update =====


class TestSaveEvalClientUpdate:
    async def _create_eval(self, pool, redis_client) -> UUID:
        """Helper: create an eval to update later."""
        result = await save_eval_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveEvalItem(name="Eval To Update")],
        )
        return result.results[0].eval_id

    async def test_update_success(self, pool, redis_client):
        """Update an existing eval's name."""
        eval_id = await self._create_eval(pool, redis_client)

        result = await save_eval_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveEvalItem(input_eval_id=eval_id, name="Updated Name")],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].eval_id == eval_id
        assert result.results[0].message == "Eval updated successfully"

    async def test_update_not_found(self, pool, redis_client):
        """Update with non-existent eval -> 404."""
        fake_id = UUID("00000000-0000-0000-0000-000000000001")

        with pytest.raises(HTTPException) as exc_info:
            await save_eval_client(
                pool,
                redis_client,
                profile_id=SUPERADMIN_PROFILE_ID,
                items=[SaveEvalItem(input_eval_id=fake_id, name="Wont Work")],
            )

        assert exc_info.value.status_code == 404


# ===== save_eval_client — validation =====


class TestSaveEvalClientValidation:
    async def test_validation_errors_returned_without_mutation(self, pool, redis_client):
        """Items with missing required fields -> errors returned, no artifact created."""
        item = SaveEvalItem()  # Missing required name

        result = await save_eval_client(
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
            await save_eval_client(
                pool,
                redis_client,
                profile_id=fake_profile,
                items=[],
            )

        assert exc_info.value.status_code == 401
