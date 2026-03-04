"""Tests for get_scenarios."""

import pytest

from app.routes.v5.tools.artifacts.scenario.get import get_scenarios
from tests.seed_ids import SEED_SCENARIO_ARTIFACT_ID

pytestmark = pytest.mark.asyncio


async def test_returns_base_columns(conn):
    items = await get_scenarios(conn, [SEED_SCENARIO_ARTIFACT_ID])

    assert len(items) == 1
    p = items[0]
    assert p.id == SEED_SCENARIO_ARTIFACT_ID
    # No junctions requested — all should be None
    assert p.name_ids is None
    assert p.description_ids is None
    assert p.department_ids is None


async def test_returns_empty_for_unknown_id(conn):
    from uuid import uuid4

    items = await get_scenarios(conn, [uuid4()])
    assert items == []


async def test_returns_empty_for_empty_ids(conn):
    items = await get_scenarios(conn, [])
    assert items == []


async def test_fetches_name_ids_when_requested(conn):
    items = await get_scenarios(conn, [SEED_SCENARIO_ARTIFACT_ID], names=True)

    assert len(items) == 1
    p = items[0]
    assert p.name_ids is not None
    # Other junctions still None
    assert p.description_ids is None


async def test_fetches_multiple_junctions(conn):
    items = await get_scenarios(
        conn,
        [SEED_SCENARIO_ARTIFACT_ID],
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
    assert p.document_ids is None


async def test_no_junctions_when_all_false(conn):
    items = await get_scenarios(conn, [SEED_SCENARIO_ARTIFACT_ID])

    p = items[0]
    for field in [
        "name_ids", "description_ids", "department_ids", "flag_ids",
        "document_ids", "image_ids", "objective_ids", "option_ids",
        "parameter_field_ids", "persona_ids", "problem_statement_ids",
        "question_ids", "video_ids", "scenario_ids",
    ]:
        assert getattr(p, field) is None
