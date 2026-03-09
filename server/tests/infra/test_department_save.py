"""Integration tests for department_save — real pool, real DB, no mocks.

Tests exercise the full save flow against testcontainers Postgres + Redis.
Test data is created via black-box tool functions.

NOTE: perform_keycloak_sync is patched out because Keycloak is not available
in the test environment. This is the only mock — all DB operations are real.
"""

from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.infra.department_save import resolve_department_values, save_department_client
from app.routes.v5.api.main.department.types import SaveDepartmentItem

from .conftest import (
    ADMIN_PROFILE_ID,
    GUEST_PROFILE_ID,
    SUPERADMIN_PROFILE_ID,
)

pytestmark = pytest.mark.asyncio

# Keycloak is not available in test env — patch it for all save_department_client calls
KEYCLOAK_PATCH = "app.infra.auth.keycloak_sync.perform_keycloak_sync"


# ---------------------------------------------------------------------------
# resolve_department_values
# ---------------------------------------------------------------------------


class TestResolveValues:
    async def test_passes_through_ids(self, pool, redis_client):
        """When IDs are already provided, no create calls happen."""
        async with pool.acquire() as conn:
            from app.routes.v5.tools.resources.names.create import create_name

            name = await create_name(conn, "Existing Dept", redis_client)

        item = SaveDepartmentItem(name_id=name.id)

        errors = await resolve_department_values(pool, redis_client, item, is_update=False)

        assert errors == []
        assert item.name_id == name.id

    async def test_creates_name_from_value(self, pool, redis_client):
        """Raw name value -> create_name -> sets name_id."""
        item = SaveDepartmentItem(name="Brand New Dept")

        errors = await resolve_department_values(pool, redis_client, item, is_update=False)

        assert errors == []
        assert item.name_id is not None

    async def test_creates_description_from_value(self, pool, redis_client, name_id):
        """Raw description value -> create_description -> sets description_id."""
        item = SaveDepartmentItem(name_id=name_id, description="A test department")

        errors = await resolve_department_values(pool, redis_client, item, is_update=False)

        assert errors == []
        assert item.description_id is not None

    async def test_required_fields_on_create(self, pool, redis_client):
        """Missing required fields on create -> errors."""
        item = SaveDepartmentItem()

        errors = await resolve_department_values(pool, redis_client, item, is_update=False)

        field_names = {e.field for e in errors}
        assert "name" in field_names

    async def test_no_required_validation_on_update(self, pool, redis_client):
        """Update mode skips required field validation."""
        item = SaveDepartmentItem()

        errors = await resolve_department_values(pool, redis_client, item, is_update=True)

        assert errors == []


# ---------------------------------------------------------------------------
# save_department_client -- create
# ---------------------------------------------------------------------------


class TestSaveDepartmentClientCreate:
    @patch(KEYCLOAK_PATCH, new_callable=AsyncMock)
    async def test_create_success(self, _mock_sync, pool, redis_client, name_id):
        """Superadmin can create a department with pre-resolved name."""
        result = await save_department_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveDepartmentItem(name_id=name_id)],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].department_id is not None

    @patch(KEYCLOAK_PATCH, new_callable=AsyncMock)
    async def test_create_with_raw_name(self, _mock_sync, pool, redis_client):
        """Superadmin can create a department with raw name (auto-resolved)."""
        result = await save_department_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveDepartmentItem(name="My New Department")],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True

    async def test_create_permission_denied(self, pool, redis_client, name_id):
        """Non-superadmin cannot create departments."""
        with pytest.raises(HTTPException) as exc_info:
            await save_department_client(
                pool,
                redis_client,
                profile_id=ADMIN_PROFILE_ID,
                items=[SaveDepartmentItem(name_id=name_id)],
            )

        assert exc_info.value.status_code == 403


# ---------------------------------------------------------------------------
# save_department_client -- update
# ---------------------------------------------------------------------------


class TestSaveDepartmentClientUpdate:
    @patch(KEYCLOAK_PATCH, new_callable=AsyncMock)
    async def _create_department(self, _mock_sync, pool, redis_client) -> UUID:
        """Helper: create a department to update later."""
        result = await save_department_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveDepartmentItem(name="Dept To Update")],
        )
        return result.results[0].department_id

    @patch(KEYCLOAK_PATCH, new_callable=AsyncMock)
    async def test_update_success(self, _mock_sync, pool, redis_client):
        """Update an existing department's name."""
        department_id = await self._create_department(pool, redis_client)

        result = await save_department_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[
                SaveDepartmentItem(
                    input_department_id=department_id, name="Updated Name"
                )
            ],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].department_id == department_id
        assert result.results[0].message == "Department updated successfully"

    async def test_update_department_not_found(self, pool, redis_client):
        """Update with non-existent department -> 404."""
        fake_id = UUID("00000000-0000-0000-0000-000000000001")

        with pytest.raises(HTTPException) as exc_info:
            await save_department_client(
                pool,
                redis_client,
                profile_id=SUPERADMIN_PROFILE_ID,
                items=[SaveDepartmentItem(input_department_id=fake_id)],
            )

        assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# save_department_client -- validation
# ---------------------------------------------------------------------------


class TestSaveDepartmentClientValidation:
    async def test_validation_errors_returned_without_mutation(self, pool, redis_client):
        """Items with missing required fields -> errors returned, no artifact created."""
        item = SaveDepartmentItem()  # Missing required name

        result = await save_department_client(
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
            await save_department_client(
                pool,
                redis_client,
                profile_id=fake_profile,
                items=[],
            )

        assert exc_info.value.status_code == 401
