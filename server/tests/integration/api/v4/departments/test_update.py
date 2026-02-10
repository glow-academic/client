"""Route tests for POST /api/v4/artifacts/departments/save (update mode)."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestDepartmentSqlParams,
    CreateTestDepartmentSqlRow,
)

from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_update_department_via_save(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    await get_superadmin_alias(db)

    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/departments/test_create_test_department_v4_complete.sql",
        params=CreateTestDepartmentSqlParams(
            title="Original Department", description="Original Description"
        ),
    )
    dept = CreateTestDepartmentSqlRow.model_validate(dept_result.model_dump())
    assert dept.department_id is not None

    detail = await client.post(
        "/api/v4/artifacts/departments/get",
        json={"department_id": str(dept.department_id), "draft_id": None},
    )
    assert detail.status_code == 200
    d = detail.json()
    name_id = d["names"]["resource"]["id"]
    desc_id = d["descriptions"]["resource"]["id"]
    flag_id = (
        d["flags"]["current"][0]["flag_option_id"]
        if d.get("flags") and d["flags"].get("current")
        else None
    )
    group_id = d["group_id"]

    response = await client.post(
        "/api/v4/artifacts/departments/save",
        json={
            "group_id": group_id,
            "input_department_id": str(dept.department_id),
            "names": {"resource_id": name_id, "create_tool_id": None, "link_tool_id": None},
            "descriptions": {
                "resource_id": desc_id,
                "create_tool_id": None,
                "link_tool_id": None,
            },
            "flags": {"resource_id": flag_id, "create_tool_id": None, "link_tool_id": None},
            "settings": {"resource_ids": [], "create_tool_id": None, "link_tool_id": None},
        },
    )

    assert response.status_code == 200
    out = response.json()
    assert out["success"] is True
    assert out.get("department_id") == str(dept.department_id)

