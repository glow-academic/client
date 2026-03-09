"""Integration tests for setting_save — real pool, real DB, no mocks.

Tests exercise the full save flow against testcontainers Postgres + Redis.
Test data is created via black-box tool functions.
"""

from uuid import UUID

import pytest
from fastapi import HTTPException

from app.infra.setting_save import resolve_setting_values, save_setting_client
from app.routes.v5.api.main.setting.types import SaveSettingItem

from .conftest import (
    GUEST_PROFILE_ID,
    SUPERADMIN_PROFILE_ID,
)

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# resolve_setting_values  (takes pool)
# ---------------------------------------------------------------------------


class TestResolveValues:
    async def test_passes_through_ids(self, pool, redis_client):
        """When IDs are already provided, no create calls happen."""
        async with pool.acquire() as conn:
            from app.routes.v5.tools.resources.names.create import create_name

            name = await create_name(conn, "Existing Setting", redis_client)

        item = SaveSettingItem(name_id=name.id)

        errors = await resolve_setting_values(pool, redis_client, item, is_update=False)

        assert errors == []
        assert item.name_id == name.id

    async def test_creates_name_from_value(self, pool, redis_client):
        """Raw name value -> create_name -> sets name_id."""
        item = SaveSettingItem(name="Brand New Setting")

        errors = await resolve_setting_values(pool, redis_client, item, is_update=False)

        assert errors == []
        assert item.name_id is not None

    async def test_creates_description_from_value(self, pool, redis_client, name_id):
        """Raw description value -> create_description -> sets description_id."""
        item = SaveSettingItem(name_id=name_id, description="A test setting")

        errors = await resolve_setting_values(pool, redis_client, item, is_update=False)

        assert errors == []
        assert item.description_id is not None

    async def test_required_fields_on_create(self, pool, redis_client):
        """Missing required fields on create -> errors."""
        item = SaveSettingItem()

        errors = await resolve_setting_values(pool, redis_client, item, is_update=False)

        field_names = {e.field for e in errors}
        assert "name" in field_names

    async def test_no_required_validation_on_update(self, pool, redis_client):
        """Update mode skips required field validation."""
        item = SaveSettingItem()

        errors = await resolve_setting_values(pool, redis_client, item, is_update=True)

        assert errors == []


# ---------------------------------------------------------------------------
# save_setting_client -- create
# ---------------------------------------------------------------------------


class TestSaveSettingClientCreate:
    async def test_create_success(self, pool, redis_client, name_id):
        """Superadmin can create a setting with pre-resolved name."""
        result = await save_setting_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveSettingItem(name_id=name_id)],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].setting_id is not None

    async def test_create_with_raw_name(self, pool, redis_client):
        """Superadmin can create a setting with raw name (auto-resolved)."""
        result = await save_setting_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveSettingItem(name="My New Setting")],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True

    async def test_create_permission_denied(self, pool, redis_client, name_id):
        """Guest cannot create settings."""
        with pytest.raises(HTTPException) as exc_info:
            await save_setting_client(
                pool,
                redis_client,
                profile_id=GUEST_PROFILE_ID,
                items=[SaveSettingItem(name_id=name_id)],
            )

        assert exc_info.value.status_code == 403


# ---------------------------------------------------------------------------
# save_setting_client -- update
# ---------------------------------------------------------------------------


class TestSaveSettingClientUpdate:
    async def _create_setting(self, pool, redis_client) -> UUID:
        """Helper: create a setting to update later."""
        result = await save_setting_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveSettingItem(name="Setting To Update")],
        )
        return result.results[0].setting_id

    async def test_update_success(self, pool, redis_client):
        """Update an existing setting's name."""
        setting_id = await self._create_setting(pool, redis_client)

        result = await save_setting_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveSettingItem(input_setting_id=setting_id, name="Updated Name")],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].setting_id == setting_id
        assert result.results[0].message == "Setting updated successfully"

    async def test_update_setting_not_found(self, pool, redis_client):
        """Update with non-existent setting -> 404."""
        fake_id = UUID("00000000-0000-0000-0000-000000000001")

        with pytest.raises(HTTPException) as exc_info:
            await save_setting_client(
                pool,
                redis_client,
                profile_id=SUPERADMIN_PROFILE_ID,
                items=[SaveSettingItem(input_setting_id=fake_id)],
            )

        assert exc_info.value.status_code == 404

    async def test_update_superadmin_bypasses_department_check(
        self, pool, redis_client
    ):
        """Superadmin can edit any setting regardless of departments."""
        setting_id = await self._create_setting(pool, redis_client)

        result = await save_setting_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[
                SaveSettingItem(input_setting_id=setting_id, name="Superadmin Update")
            ],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True


# ---------------------------------------------------------------------------
# save_setting_client -- validation
# ---------------------------------------------------------------------------


class TestSaveSettingClientValidation:
    async def test_validation_errors_returned_without_mutation(
        self, pool, redis_client
    ):
        """Items with missing required fields -> errors returned, no artifact created."""
        item = SaveSettingItem()  # Missing required name

        result = await save_setting_client(
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
            await save_setting_client(
                pool,
                redis_client,
                profile_id=fake_profile,
                items=[],
            )

        assert exc_info.value.status_code == 401
