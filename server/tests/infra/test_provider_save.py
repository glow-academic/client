"""Integration tests for provider_save — real pool, real DB, no mocks.

Tests exercise the full save flow against testcontainers Postgres + Redis.
Test data is created via black-box tool functions.
"""

from uuid import UUID

import pytest
from fastapi import HTTPException

from app.infra.provider_save import resolve_provider_values, save_provider_client
from app.routes.v5.api.main.provider.types import SaveProviderItem

from .conftest import (
    GUEST_PROFILE_ID,
    MEMBER_PROFILE_ID,
    SUPERADMIN_PROFILE_ID,
)

pytestmark = pytest.mark.asyncio


# ===== resolve_provider_values =====


class TestResolveValues:
    async def test_passes_through_ids(self, pool, redis_client):
        """When IDs are already provided, no create calls happen."""
        async with pool.acquire() as conn:
            from app.routes.v5.tools.resources.names.create import create_name

            name = await create_name(conn, "Existing Provider", redis_client)

        item = SaveProviderItem(name_id=name.id)

        async with pool.acquire() as conn:
            errors = await resolve_provider_values(
                conn, redis_client, item, is_update=False
            )

        assert errors == []
        assert item.name_id == name.id

    async def test_creates_name_from_value(self, pool, redis_client):
        """Raw name value -> create_name -> sets name_id."""
        item = SaveProviderItem(name="Brand New Provider")

        async with pool.acquire() as conn:
            errors = await resolve_provider_values(
                conn, redis_client, item, is_update=False
            )

        assert errors == []
        assert item.name_id is not None

    async def test_creates_description_from_value(self, pool, redis_client, name_id):
        """Raw description value -> create_description -> sets description_id."""
        item = SaveProviderItem(name_id=name_id, description="A useful provider")

        async with pool.acquire() as conn:
            errors = await resolve_provider_values(
                conn, redis_client, item, is_update=False
            )

        assert errors == []
        assert item.description_id is not None

    async def test_required_fields_on_create(self, pool, redis_client):
        """Missing required fields on create -> errors."""
        item = SaveProviderItem()

        async with pool.acquire() as conn:
            errors = await resolve_provider_values(
                conn, redis_client, item, is_update=False
            )

        field_names = {e.field for e in errors}
        assert "name" in field_names

    async def test_no_required_validation_on_update(self, pool, redis_client):
        """Update mode skips required field validation."""
        item = SaveProviderItem()

        async with pool.acquire() as conn:
            errors = await resolve_provider_values(
                conn, redis_client, item, is_update=True
            )

        assert errors == []


# ===== save_provider_client — create =====


class TestSaveProviderClientCreate:
    async def test_create_success(self, pool, redis_client, name_id):
        """Superadmin can create a provider with pre-resolved name."""
        result = await save_provider_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveProviderItem(name_id=name_id)],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].provider_id is not None

    async def test_create_with_raw_name(self, pool, redis_client):
        """Superadmin can create a provider with raw name (auto-resolved)."""
        result = await save_provider_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveProviderItem(name="My New Provider")],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True

    async def test_create_permission_denied(self, pool, redis_client, name_id):
        """Guest cannot create providers."""
        with pytest.raises(HTTPException) as exc_info:
            await save_provider_client(
                pool,
                redis_client,
                profile_id=GUEST_PROFILE_ID,
                items=[SaveProviderItem(name_id=name_id)],
            )

        assert exc_info.value.status_code == 403


# ===== save_provider_client — update =====


class TestSaveProviderClientUpdate:
    async def _create_provider(self, pool, redis_client) -> UUID:
        """Helper: create a provider to update later."""
        result = await save_provider_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveProviderItem(name="Provider To Update")],
        )
        return result.results[0].provider_id

    async def test_update_success(self, pool, redis_client):
        """Update an existing provider's name."""
        provider_id = await self._create_provider(pool, redis_client)

        result = await save_provider_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[
                SaveProviderItem(
                    input_provider_id=provider_id, name="Updated Name"
                )
            ],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].provider_id == provider_id
        assert result.results[0].message == "Provider updated successfully"

    async def test_update_not_found(self, pool, redis_client):
        """Update with non-existent provider -> 404."""
        fake_id = UUID("00000000-0000-0000-0000-000000000001")

        with pytest.raises(HTTPException) as exc_info:
            await save_provider_client(
                pool,
                redis_client,
                profile_id=SUPERADMIN_PROFILE_ID,
                items=[
                    SaveProviderItem(
                        input_provider_id=fake_id, name="Wont Work"
                    )
                ],
            )

        assert exc_info.value.status_code == 404


# ===== save_provider_client — validation =====


class TestSaveProviderClientValidation:
    async def test_validation_errors_returned_without_mutation(self, pool, redis_client):
        """Items with missing required fields -> errors returned, no artifact created."""
        item = SaveProviderItem()  # Missing required name

        result = await save_provider_client(
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
            await save_provider_client(
                pool,
                redis_client,
                profile_id=fake_profile,
                items=[],
            )

        assert exc_info.value.status_code == 401
