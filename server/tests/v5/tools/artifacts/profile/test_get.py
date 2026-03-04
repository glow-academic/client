"""Tests for get_profiles."""

import pytest

from app.routes.v5.tools.artifacts.profile.get import get_profiles
from tests.seed_ids import SEED_PROFILE_ARTIFACT_ID

pytestmark = pytest.mark.asyncio


async def test_returns_base_columns(conn):
    items = await get_profiles(conn, [SEED_PROFILE_ARTIFACT_ID])

    assert len(items) == 1
    p = items[0]
    assert p.id == SEED_PROFILE_ARTIFACT_ID
    # No junctions requested — all should be None
    assert p.name_ids is None
    assert p.department_ids is None
    assert p.flag_ids is None


async def test_returns_empty_for_unknown_id(conn):
    from uuid import uuid4

    items = await get_profiles(conn, [uuid4()])
    assert items == []


async def test_returns_empty_for_empty_ids(conn):
    items = await get_profiles(conn, [])
    assert items == []


async def test_fetches_name_ids_when_requested(conn):
    items = await get_profiles(conn, [SEED_PROFILE_ARTIFACT_ID], names=True)

    assert len(items) == 1
    p = items[0]
    assert p.name_ids is not None
    # Other junctions still None
    assert p.department_ids is None


async def test_fetches_multiple_junctions(conn):
    items = await get_profiles(
        conn,
        [SEED_PROFILE_ARTIFACT_ID],
        names=True,
        departments=True,
        roles=True,
    )

    assert len(items) == 1
    p = items[0]
    assert p.name_ids is not None
    assert p.department_ids is not None
    assert p.role_ids is not None
    # Unrequested junctions stay None
    assert p.flag_ids is None
    assert p.email_ids is None


async def test_no_junctions_when_all_false(conn):
    items = await get_profiles(conn, [SEED_PROFILE_ARTIFACT_ID])

    p = items[0]
    for field in [
        "name_ids", "department_ids", "flag_ids", "email_ids",
        "profile_ids", "request_limit_ids", "role_ids",
    ]:
        assert getattr(p, field) is None
