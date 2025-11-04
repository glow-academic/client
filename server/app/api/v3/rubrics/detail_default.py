"""Rubric detail default endpoint - v3 API."""

import json
import uuid
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.utils.schema import DepartmentMappingItem
from app.utils.sql_helper import load_sql

# Reuse models from detail.py
from app.api.v3.rubrics.detail import (
    RubricDetailResponse,
    StandardGroupDetail,
)


class RubricDetailDefaultRequest(BaseModel):
    """Request for default rubric detail."""

    profileId: str


router = APIRouter()


@router.post("/detail-default", response_model=RubricDetailResponse)
async def get_rubric_detail_default(
    request: RubricDetailDefaultRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RubricDetailResponse:
    """Get default rubric detail information."""
    try:
        sql = load_sql("sql/v3/rubrics/get_rubric_detail_default_complete.sql")
        row = await conn.fetchrow(sql, uuid.UUID(request.profileId))

        if not row:
            raise HTTPException(status_code=404, detail="No rubrics found for user's departments")

        # Parse standard groups from JSONB (same as detail.py)
        standard_groups_detail: dict[str, StandardGroupDetail] = {}
        standard_groups_mapping: dict[str, dict[str, str]] = {}
        standards_mapping: dict[str, dict[str, str]] = {}
        standard_group_ids: list[str] = []

        if row.get("standard_groups_complete"):
            groups_data = row["standard_groups_complete"]
            if isinstance(groups_data, str):
                groups_data = json.loads(groups_data)
            if isinstance(groups_data, list):
                for group in groups_data:
                    if isinstance(group, dict):
                        group_id = group.get("id", "")
                        standard_group_ids.append(group_id)
                        standard_ids = []
                        if group.get("standards"):
                            for std in group["standards"]:
                                if isinstance(std, dict):
                                    std_id = std.get("id", "")
                                    standard_ids.append(std_id)
                                    standards_mapping[std_id] = {
                                        "name": std.get("name", ""),
                                        "description": std.get("description", ""),
                                    }
                        standard_groups_detail[group_id] = StandardGroupDetail(
                            points=group.get("points", 0),
                            passPoints=group.get("passPoints", 0),
                            standard_ids=standard_ids,
                        )
                        standard_groups_mapping[group_id] = {
                            "name": group.get("name", ""),
                            "description": group.get("description", ""),
                        }

        # Parse department mapping (same as detail.py)
        department_mapping: dict[str, DepartmentMappingItem] = {}
        if row.get("department_mapping"):
            dept_data = row["department_mapping"]
            if isinstance(dept_data, str):
                dept_data = json.loads(dept_data)
            if isinstance(dept_data, dict):
                for did, ddata in dept_data.items():
                    if isinstance(ddata, dict):
                        department_mapping[did] = DepartmentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                        )

        # Compute can_edit permission
        user_role = row.get("user_role", "trainee")
        can_edit = user_role in ("admin", "superadmin")

        # Convert arrays
        valid_department_ids = [str(did) for did in (row.get("valid_department_ids") or [])]
        dept_ids = None
        if row.get("department_ids"):
            dept_ids = [str(d) for d in row["department_ids"]]

        return RubricDetailResponse(
            name=row.get("name", ""),
            description=row.get("description", ""),
            department_ids=dept_ids,
            valid_department_ids=valid_department_ids,
            points=row.get("points", 0),
            passPoints=row.get("passpoints", 0),
            active=row.get("active", False),
            can_edit=can_edit,
            standard_group_ids=standard_group_ids,
            standard_groups_detail=standard_groups_detail,
            standard_groups_mapping=standard_groups_mapping,
            standards_mapping=standards_mapping,
            department_mapping=department_mapping,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

