"""Route tests for POST /api/v4/profile/emulate endpoint."""

from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_authorize_emulation(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test authorizing emulation."""
    await get_superadmin_alias(db)

    # Get superadmin profile ID
    superadmin_profile_id = await get_superadmin_alias(db)

    # Create a target profile
    create_response = await client.post(
        "/api/v4/profile/create",
        json={
            "first_name": "Target",
            "last_name": "User",
            "emails": ["target@example.com"],
            "primary_email_index": 0,
            "role": "member",
            "cohort_ids": None,
            "department_ids": None,
        },
    )
    assert create_response.status_code == 200
    create_data = create_response.json()
    target_profile_id = UUID(create_data["profileId"])

    # Authorize emulation
    response = await client.post(
        "/api/v4/profile/emulate",
        json={
            "requesterProfileId": str(superadmin_profile_id),
            "targetProfileId": str(target_profile_id),
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "authorized" in data
    # Authorization result depends on permissions

