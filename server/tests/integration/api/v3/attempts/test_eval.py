"""Integration tests for POST /api/v3/attempts/eval endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import (
    get_cs_dept_id,  # type: ignore
    get_superadmin_alias,
)

pytestmark = pytest.mark.asyncio


async def _create_test_eval_attempt(
    db: asyncpg.Connection,
    eval_id: str,
    profile_id: str,
) -> str:
    """Create a test eval attempt."""
    attempt_id = await db.fetchval(
        "INSERT INTO eval_attempts(eval_id) VALUES ($1) RETURNING id",
        eval_id,
    )
    return str(attempt_id)


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


async def test_get_eval_attempt_basic(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting eval attempt details."""
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    eval_id = await _create_test_eval(db, "Test Eval", dept_id)
    attempt_id = await _create_test_eval_attempt(db, eval_id, profile_id)

    response = await client.post(
        "/api/v3/attempts/eval",
        json={"attemptId": attempt_id},
        headers={"X-Cache-Update": "999999"},
    )

    assert response.status_code == 200
    data = response.json()

    assert "attempt" in data
    assert "eval" in data
    assert "runs" in data
    assert "status_summary" in data

    assert data["attempt"]["id"] == attempt_id
    assert data["attempt"]["eval_id"] == eval_id
    assert data["eval"]["eval_id"] == eval_id
    assert data["eval"]["name"] == "Test Eval"
    assert isinstance(data["runs"], list)
    assert isinstance(data["status_summary"], dict)


async def test_get_eval_attempt_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting non-existent eval attempt returns 404."""
    import uuid

    fake_attempt_id = str(uuid.uuid4())

    response = await client.post(
        "/api/v3/attempts/eval",
        json={"attemptId": fake_attempt_id},
        headers={"X-Cache-Update": "999999"},
    )

    assert response.status_code == 404
