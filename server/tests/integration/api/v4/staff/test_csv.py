"""Route tests for POST /api/v4/staff/csv endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_process_csv(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test processing CSV file."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/staff/csv",
        json={
            "csv_data": "first_name,last_name,email\nTest,Staff,test@example.com",
            "column_mapping": {},
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "processed_rows" in data
    assert isinstance(data["processed_rows"], list)

