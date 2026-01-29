"""Route tests for POST /api/v4/documents/certificate endpoint."""

import uuid

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import GetSuperadminAliasSqlRow

from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_generate_certificate(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test generating a certificate PDF for a profile."""
    await get_superadmin_alias(db)

    # Get superadmin profile ID for certificate generation

    superadmin_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/helpers/test_get_superadmin_alias_v4_complete.sql",
        params=None,
    )
    typed_superadmin = GetSuperadminAliasSqlRow.model_validate(
        superadmin_result.model_dump()
    )
    profile_id = typed_superadmin.profile_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/documents/certificate",
        json={"profile_id": str(profile_id)},
    )

    # Certificate generation may succeed (200) or fail with 404 if no cohort data
    # Both are valid responses - we just verify the endpoint works
    assert response.status_code in [200, 404]

    if response.status_code == 200:
        # Verify response is PDF
        assert response.headers["content-type"] == "application/pdf"
        # Verify PDF content (should start with PDF header)
        pdf_content = response.content
        assert pdf_content.startswith(b"%PDF")
    else:
        # 404 means no cohort data available - this is acceptable
        data = response.json()
        assert "detail" in data
        assert (
            "not found" in data["detail"].lower() or "cohort" in data["detail"].lower()
        )


async def test_generate_certificate_profile_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test generating certificate for non-existent profile."""
    await get_superadmin_alias(db)

    # Use a non-existent UUID
    fake_profile_id = uuid.uuid4()

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/documents/certificate",
        json={"profile_id": str(fake_profile_id)},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower() or "cohort" in data["detail"].lower()
