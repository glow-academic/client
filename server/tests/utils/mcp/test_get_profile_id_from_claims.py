"""Tests for MCP profile lookup from OAuth claims."""

import pytest

from app.tools.artifacts.profile.create import create_profile
from app.tools.resources.emails.create import create_email
from app.utils.mcp.get_profile_id_from_claims import get_profile_id_from_claims

pytestmark = pytest.mark.asyncio


async def test_returns_profile_id_for_matching_email(conn, redis_client):
    email = await create_email(conn, "claims-user@example.com", redis_client)
    profile = await create_profile(conn, email_ids=[email.id], redis=redis_client)

    result = await get_profile_id_from_claims(
        {"email": "claims-user@example.com"},
        conn,
    )

    assert result == str(profile.id)


async def test_returns_none_when_email_missing_or_unknown(conn, redis_client):
    assert await get_profile_id_from_claims({}, conn) is None
    assert (
        await get_profile_id_from_claims(
            {"email": "missing@example.com"},
            conn,
        )
        is None
    )
