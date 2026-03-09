"""Integration tests for document_save — real pool, real DB, no mocks.

Tests exercise the full save flow against testcontainers Postgres + Redis.
Test data is created via black-box tool functions.
"""

from uuid import UUID

import pytest
from fastapi import HTTPException

from app.infra.document_save import resolve_document_values, save_document_client
from app.routes.v5.api.main.document.types import SaveDocumentItem

from .conftest import (
    ADMIN_PROFILE_ID,
    GUEST_PROFILE_ID,
    SUPERADMIN_PROFILE_ID,
)

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# resolve_document_values  (takes conn, not pool)
# ---------------------------------------------------------------------------


class TestResolveValues:
    async def test_passes_through_ids(self, pool, redis_client):
        """When IDs are already provided, no create calls happen."""
        async with pool.acquire() as conn:
            from app.routes.v5.tools.resources.names.create import create_name

            name = await create_name(conn, "Existing Doc", redis_client)

        item = SaveDocumentItem(name_id=name.id)

        async with pool.acquire() as conn:
            errors = await resolve_document_values(conn, redis_client, item, is_update=False)

        assert errors == []
        assert item.name_id == name.id

    async def test_creates_name_from_value(self, pool, redis_client):
        """Raw name value -> create_name -> sets name_id."""
        item = SaveDocumentItem(name="Brand New Doc")

        async with pool.acquire() as conn:
            errors = await resolve_document_values(conn, redis_client, item, is_update=False)

        assert errors == []
        assert item.name_id is not None

    async def test_creates_description_from_value(self, pool, redis_client, name_id):
        """Raw description value -> create_description -> sets description_id."""
        item = SaveDocumentItem(name_id=name_id, description="A test document")

        async with pool.acquire() as conn:
            errors = await resolve_document_values(conn, redis_client, item, is_update=False)

        assert errors == []
        assert item.description_id is not None

    async def test_required_fields_on_create(self, pool, redis_client):
        """Missing required fields on create -> errors."""
        item = SaveDocumentItem()

        async with pool.acquire() as conn:
            errors = await resolve_document_values(conn, redis_client, item, is_update=False)

        field_names = {e.field for e in errors}
        assert "name" in field_names


# ---------------------------------------------------------------------------
# save_document_client -- create
# ---------------------------------------------------------------------------


class TestSaveDocumentClientCreate:
    async def test_create_success(self, pool, redis_client, name_id):
        """Superadmin can create a document with pre-resolved name."""
        result = await save_document_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveDocumentItem(name_id=name_id)],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].document_id is not None

    async def test_create_with_raw_name(self, pool, redis_client):
        """Superadmin can create a document with raw name (auto-resolved)."""
        result = await save_document_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveDocumentItem(name="My New Document")],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True

    async def test_create_permission_denied(self, pool, redis_client, name_id):
        """Guest cannot create documents."""
        with pytest.raises(HTTPException) as exc_info:
            await save_document_client(
                pool,
                redis_client,
                profile_id=GUEST_PROFILE_ID,
                items=[SaveDocumentItem(name_id=name_id)],
            )

        assert exc_info.value.status_code == 403

    async def test_bulk_create_multiple_items(self, pool, redis_client):
        """Bulk create with multiple items succeeds."""
        result = await save_document_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[
                SaveDocumentItem(name="Doc One"),
                SaveDocumentItem(name="Doc Two"),
            ],
        )

        assert len(result.results) == 2
        assert result.results[0].success is True
        assert result.results[0].document_id is not None
        assert result.results[1].success is True
        assert result.results[1].document_id is not None


# ---------------------------------------------------------------------------
# save_document_client -- update
# ---------------------------------------------------------------------------


class TestSaveDocumentClientUpdate:
    async def _create_document(self, pool, redis_client) -> UUID:
        """Helper: create a document to update later."""
        result = await save_document_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[SaveDocumentItem(name="Doc To Update")],
        )
        return result.results[0].document_id

    async def test_update_success(self, pool, redis_client):
        """Update an existing document's name."""
        document_id = await self._create_document(pool, redis_client)

        result = await save_document_client(
            pool,
            redis_client,
            profile_id=SUPERADMIN_PROFILE_ID,
            items=[
                SaveDocumentItem(input_document_id=document_id, name="Updated Name")
            ],
        )

        assert len(result.results) == 1
        assert result.results[0].success is True
        assert result.results[0].document_id == document_id
        assert result.results[0].message == "Document updated successfully"

    async def test_update_document_not_found(self, pool, redis_client):
        """Update with non-existent document -> 404."""
        fake_id = UUID("00000000-0000-0000-0000-000000000001")

        with pytest.raises(HTTPException) as exc_info:
            await save_document_client(
                pool,
                redis_client,
                profile_id=SUPERADMIN_PROFILE_ID,
                items=[SaveDocumentItem(input_document_id=fake_id)],
            )

        assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# save_document_client -- validation
# ---------------------------------------------------------------------------


class TestSaveDocumentClientValidation:
    async def test_validation_errors_returned_without_mutation(self, pool, redis_client):
        """Items with missing required fields -> errors returned, no artifact created."""
        item = SaveDocumentItem()  # Missing required name

        result = await save_document_client(
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
            await save_document_client(
                pool,
                redis_client,
                profile_id=fake_profile,
                items=[],
            )

        assert exc_info.value.status_code == 401
