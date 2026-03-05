"""Tests for get_auths."""

import pytest

from app.routes.v5.tools.artifacts.auth.get import get_auths
from tests.seed_ids import SEED_AUTH_ARTIFACT_ID
from tests.helpers import nonexistent_id

pytestmark = pytest.mark.asyncio


async def test_returns_base_columns(conn):
    items = await get_auths(conn, [SEED_AUTH_ARTIFACT_ID])

    assert len(items) == 1
    p = items[0]
    assert p.id == SEED_AUTH_ARTIFACT_ID
    # No junctions requested — all should be None
    assert p.name_ids is None
    assert p.description_ids is None
    assert p.department_ids is None


async def test_returns_empty_for_unknown_id(conn):

    items = await get_auths(conn, [nonexistent_id()])
    assert items == []


async def test_returns_empty_for_empty_ids(conn):
    items = await get_auths(conn, [])
    assert items == []


async def test_fetches_name_ids_when_requested(conn):
    items = await get_auths(conn, [SEED_AUTH_ARTIFACT_ID], names=True)

    assert len(items) == 1
    p = items[0]
    assert p.name_ids is not None
    # Other junctions still None
    assert p.description_ids is None


async def test_fetches_multiple_junctions(conn):
    items = await get_auths(
        conn,
        [SEED_AUTH_ARTIFACT_ID],
        names=True,
        descriptions=True,
        flags=True,
    )

    assert len(items) == 1
    p = items[0]
    assert p.name_ids is not None
    assert p.description_ids is not None
    assert p.flag_ids is not None
    # Unrequested junctions stay None
    assert p.department_ids is None
    assert p.item_ids is None


async def test_no_junctions_when_all_false(conn):
    items = await get_auths(conn, [SEED_AUTH_ARTIFACT_ID])

    p = items[0]
    for field in [
        "name_ids", "description_ids", "department_ids", "flag_ids",
        "item_ids", "protocol_ids", "slug_ids", "auth_ids",
    ]:
        assert getattr(p, field) is None
