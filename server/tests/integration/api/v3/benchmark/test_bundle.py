"""Integration tests for POST /api/v3/benchmark/bundle endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import (
    get_cs_dept_id,  # type: ignore
    get_superadmin_alias,
)

pytestmark = pytest.mark.asyncio


async def _create_test_eval(
    db: asyncpg.Connection,
    name: str = "Test Eval",
    department_id: str | None = None,
) -> str:
    """Create a test eval."""
    rubric_id = await db.fetchval("SELECT id FROM rubrics LIMIT 1")
    if not rubric_id:
        rubric_id = await db.fetchval(
            "INSERT INTO rubrics(name, description, points, pass_points, active) "
            "VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
        )

    eval_id = await db.fetchval(
        "INSERT INTO evals(name, description, rubric_id, active) "
        "VALUES ($1, 'Test Description', $2, true) RETURNING id",
        name,
        rubric_id,
    )

    if department_id:
        await db.execute(
            "INSERT INTO eval_departments(eval_id, department_id, active) "
            "VALUES ($1, $2, true)",
            eval_id,
            department_id,
        )

    return str(eval_id)


async def _create_test_eval_attempt(
    db: asyncpg.Connection,
    eval_id: str,
) -> str:
    """Create a test eval attempt."""
    attempt_id = await db.fetchval(
        "INSERT INTO eval_attempts(eval_id) VALUES ($1) RETURNING id",
        eval_id,
    )
    return str(attempt_id)


async def test_get_benchmark_bundle_basic(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting benchmark bundle with evals and attempts."""
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    eval_id = await _create_test_eval(db, "Test Eval", dept_id)
    attempt_id = await _create_test_eval_attempt(db, eval_id)

    response = await client.post(
        "/api/v3/benchmark/bundle",
        json={},
        headers={"X-Cache-Update": "999999"},
    )

    assert response.status_code == 200
    data = response.json()

    assert "evals" in data
    assert "attempts" in data
    assert "total_count" in data
    assert "page" in data
    assert "page_size" in data
    assert "total_pages" in data
    assert "rubric_mapping" in data
    assert "department_mapping" in data
    assert "agent_mapping" in data
    assert "standard_groups_mapping" in data
    assert "standards_mapping" in data
    assert "rubric_standard_groups_mapping" in data
    assert "rubric_options" in data
    assert "department_options" in data
    assert "agent_options" in data

    assert isinstance(data["evals"], list)
    assert isinstance(data["attempts"], list)
    assert isinstance(data["rubric_mapping"], dict)
    assert isinstance(data["department_mapping"], dict)
    assert isinstance(data["agent_mapping"], dict)

    # Verify eval is in the list
    eval_found = any(e["eval_id"] == eval_id for e in data["evals"])
    assert eval_found

    # Verify attempt is in the list
    attempt_found = any(a["attempt_id"] == attempt_id for a in data["attempts"])
    assert attempt_found


async def test_get_benchmark_bundle_with_filters(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting benchmark bundle with filters."""
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    eval_id = await _create_test_eval(db, "Test Eval", dept_id)
    attempt_id = await _create_test_eval_attempt(db, eval_id)

    response = await client.post(
        "/api/v3/benchmark/bundle",
        json={
            "evalIds": [eval_id],
            "status": "pending",
            "page": 0,
            "pageSize": 20,
        },
        headers={"X-Cache-Update": "999999"},
    )

    assert response.status_code == 200
    data = response.json()

    assert "evals" in data
    assert "attempts" in data
    assert isinstance(data["evals"], list)
    assert isinstance(data["attempts"], list)
