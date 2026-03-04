"""Tests for get_cohorts."""

import pytest

from app.routes.v5.tools.artifacts.cohort.get import get_cohorts
from tests.seed_ids import SEED_COHORT_ARTIFACT_ID

pytestmark = pytest.mark.asyncio


async def test_returns_base_columns(conn):
    items = await get_cohorts(conn, [SEED_COHORT_ARTIFACT_ID])

    assert len(items) == 1
    p = items[0]
    assert p.id == SEED_COHORT_ARTIFACT_ID
    # No junctions requested — all should be None
    assert p.name_ids is None
    assert p.description_ids is None
    assert p.department_ids is None


async def test_returns_empty_for_unknown_id(conn):
    from uuid import uuid4

    items = await get_cohorts(conn, [uuid4()])
    assert items == []


async def test_returns_empty_for_empty_ids(conn):
    items = await get_cohorts(conn, [])
    assert items == []


async def test_fetches_name_ids_when_requested(conn):
    items = await get_cohorts(conn, [SEED_COHORT_ARTIFACT_ID], names=True)

    assert len(items) == 1
    p = items[0]
    assert p.name_ids is not None
    # Other junctions still None
    assert p.description_ids is None


async def test_fetches_multiple_junctions(conn):
    items = await get_cohorts(
        conn,
        [SEED_COHORT_ARTIFACT_ID],
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
    assert p.profiles_ids is None


async def test_no_junctions_when_all_false(conn):
    items = await get_cohorts(conn, [SEED_COHORT_ARTIFACT_ID])

    p = items[0]
    for field in [
        "name_ids", "description_ids", "department_ids", "flag_ids",
        "profiles_ids", "profile_persona_ids", "simulation_ids",
        "simulation_availability_ids", "simulation_position_ids", "cohort_ids",
    ]:
        assert getattr(p, field) is None
