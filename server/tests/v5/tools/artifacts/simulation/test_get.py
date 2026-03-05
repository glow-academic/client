"""Tests for get_simulations."""

import pytest

from app.routes.v5.tools.artifacts.simulation.get import get_simulations
from tests.seed_ids import SEED_SIMULATION_ARTIFACT_ID
from tests.helpers import nonexistent_id

pytestmark = pytest.mark.asyncio


async def test_returns_base_columns(conn):
    items = await get_simulations(conn, [SEED_SIMULATION_ARTIFACT_ID])

    assert len(items) == 1
    p = items[0]
    assert p.id == SEED_SIMULATION_ARTIFACT_ID
    # No junctions requested — all should be None
    assert p.name_ids is None
    assert p.description_ids is None
    assert p.department_ids is None


async def test_returns_empty_for_unknown_id(conn):

    items = await get_simulations(conn, [nonexistent_id()])
    assert items == []


async def test_returns_empty_for_empty_ids(conn):
    items = await get_simulations(conn, [])
    assert items == []


async def test_fetches_name_ids_when_requested(conn):
    items = await get_simulations(conn, [SEED_SIMULATION_ARTIFACT_ID], names=True)

    assert len(items) == 1
    p = items[0]
    assert p.name_ids is not None
    # Other junctions still None
    assert p.description_ids is None


async def test_fetches_multiple_junctions(conn):
    items = await get_simulations(
        conn,
        [SEED_SIMULATION_ARTIFACT_ID],
        names=True,
        descriptions=True,
        departments=True,
    )

    assert len(items) == 1
    p = items[0]
    assert p.name_ids is not None
    assert p.description_ids is not None
    assert p.department_ids is not None
    # Unrequested junctions stay None
    assert p.flag_ids is None
    assert p.scenario_ids is None


async def test_no_junctions_when_all_false(conn):
    items = await get_simulations(conn, [SEED_SIMULATION_ARTIFACT_ID])

    p = items[0]
    for field in [
        "name_ids", "description_ids", "department_ids", "flag_ids",
        "scenario_ids", "scenario_flag_ids", "scenario_position_ids",
        "scenario_rubric_ids", "scenario_time_limit_ids", "simulation_ids",
    ]:
        assert getattr(p, field) is None
