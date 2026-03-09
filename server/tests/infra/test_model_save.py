"""Integration tests for model_save — real pool, real DB, no mocks.

Tests exercise the full save flow against testcontainers Postgres + Redis.
Test data is created via black-box tool functions.
"""

from uuid import UUID

import pytest
from fastapi import HTTPException

from app.infra.model_save import resolve_model_values, save_model_client
from app.routes.v5.api.main.model.types import SaveModelItem

from .conftest import (
    ADMIN_PROFILE_ID,
    GUEST_PROFILE_ID,
    SUPERADMIN_PROFILE_ID,
)

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# resolve_model_values  (takes pool)
# ---------------------------------------------------------------------------


class TestResolveValues:
    async def test_passes_through_ids(self, pool, redis_client):
        """When IDs are already provided, no create calls happen."""
        async with pool.acquire() as conn:
            from app.routes.v5.tools.resources.names.create import create_name

            name = await create_name(conn, "Existing Model", redis_client)

        item = SaveModelItem(name_id=name.id)

        errors = await resolve_model_values(pool, redis_client, item, is_update=False)

        assert errors == []
        assert item.name_id == name.id

    async def test_creates_name_from_value(self, pool, redis_client):
        """Raw name value -> create_name -> sets name_id."""
        item = SaveModelItem(name="Brand New Model")

        errors = await resolve_model_values(pool, redis_client, item, is_update=False)

        assert errors == []
        assert item.name_id is not None

    async def test_creates_description_from_value(self, pool, redis_client, name_id):
        """Raw description value -> create_description -> sets description_id."""
        item = SaveModelItem(name_id=name_id, description="A test model")

        errors = await resolve_model_values(pool, redis_client, item, is_update=False)

        assert errors == []
        assert item.description_id is not None

    async def test_required_fields_on_create(self, pool, redis_client):
        """Missing required fields on create -> errors."""
        item = SaveModelItem()

        errors = await resolve_model_values(pool, redis_client, item, is_update=False)

        field_names = {e.field for e in errors}
        assert "name" in field_names

    async def test_no_required_validation_on_update(self, pool, redis_client):
        """Update mode skips required field validation."""
        item = SaveModelItem()

        errors = await resolve_model_values(pool, redis_client, item, is_update=True)

        assert errors == []


# ---------------------------------------------------------------------------
# save_model_client -- create
# ---------------------------------------------------------------------------


class TestSaveModelClientCreate:
    async def test_create_success(self, pool, redis_client, name_id):
        """Superadmin can create a model with pre-resolved name."""
        result = await save_model_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveModelItem(name_id=name_id)],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].model_id is not None

    async def test_create_with_raw_name(self, pool, redis_client):
        """Superadmin can create a model with raw name (auto-resolved)."""
        result = await save_model_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveModelItem(name="My New Model")],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True

    async def test_create_permission_denied(self, pool, redis_client, name_id):
        """Guest cannot create models."""
        with pytest.raises(HTTPException) as exc_info:
            await save_model_client(
                pool,
                redis_client,
                profile_id=GUEST_PROFILE_ID,
                items=[SaveModelItem(name_id=name_id)],
            )

        assert exc_info.value.status_code == 403


# ---------------------------------------------------------------------------
# save_model_client -- update
# ---------------------------------------------------------------------------


class TestSaveModelClientUpdate:
    async def _create_model(self, pool, redis_client) -> UUID:
        """Helper: create a model to update later."""
        result = await save_model_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveModelItem(name="Model To Update")],
        )
        return result.results[0].model_id

    async def test_update_success(self, pool, redis_client):
        """Update an existing model's name."""
        model_id = await self._create_model(pool, redis_client)

        result = await save_model_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveModelItem(input_model_id=model_id, name="Updated Name")],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].model_id == model_id
        assert result.results[0].message == "Model updated successfully"

    async def test_update_model_not_found(self, pool, redis_client):
        """Update with non-existent model -> 404."""
        fake_id = UUID("00000000-0000-0000-0000-000000000001")

        with pytest.raises(HTTPException) as exc_info:
            await save_model_client(
                pool,
                redis_client,
                profile_id=SUPERADMIN_PROFILE_ID,
                items=[SaveModelItem(input_model_id=fake_id)],
            )

        assert exc_info.value.status_code == 404

    async def test_update_no_active_agents_succeeds(self, pool, redis_client):
        """A model with no active agents can be updated by superadmin."""
        model_id = await self._create_model(pool, redis_client)

        # Model with no active agents — update should succeed
        result = await save_model_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveModelItem(input_model_id=model_id, name="Superadmin Update")],
        )
        assert result.results[0].success is True


# ---------------------------------------------------------------------------
# save_model_client -- validation
# ---------------------------------------------------------------------------


class TestSaveModelClientValidation:
    async def test_validation_errors_returned_without_mutation(self, pool, redis_client):
        """Items with missing required fields -> errors returned, no artifact created."""
        item = SaveModelItem()  # Missing required name

        result = await save_model_client(
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
            await save_model_client(
                pool,
                redis_client,
                profile_id=fake_profile,
                items=[],
            )

        assert exc_info.value.status_code == 401
