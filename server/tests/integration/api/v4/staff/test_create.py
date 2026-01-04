"""Route tests for POST /api/v4/staff/create endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_create_staff(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test bulk creating staff."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/staff/create",
        json={
            "profiles": [
                {
                    "first_name": "Test",
                    "last_name": "Staff",
                    "emails": ["teststaff@example.com"],
                    "primary_email_index": 0,
                    "role": "member",
                    "cohort_ids": None,
                    "department_ids": None,
                }
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "success" in data
    assert data["success"] is True
    assert "profiles" in data
    assert len(data["profiles"]) > 0

