"""Eval detail endpoint - v3 API following DHH principles."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import (
    DepartmentMapping,
    DepartmentMappingItem,
)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class EvalDetailRequest(BaseModel):
    """Request to get eval details."""

    evalId: str
    profileId: str


class ModelRunItem(BaseModel):
    """Model run item in eval detail."""

    model_run_id: str
    completed: bool
    assigned_at: str
    status_updated_at: str
    model_run_created_at: str
    model_id: str | None
    model_name: str | None
    agent_id: str | None
    agent_name: str | None
    persona_id: str | None
    persona_name: str | None
    profile_id: str | None
    profile_name: str | None
    has_grade: bool
    grade_score: int | None
    grade_passed: bool | None
    grade_created_at: str | None


class EvalDetailResponse(BaseModel):
    """Detailed eval response with all fields and metadata."""

    # Basic eval fields
    eval_id: str
    name: str
    description: str
    rubric_id: str
    rubric_name: str
    rubric_description: str
    rubric_points: int
    rubric_pass_points: int
    created_at: str
    updated_at: str
    department_ids: list[str] | None

    # Status breakdown
    total_runs: int
    completed_runs: int
    pending_runs: int
    status: str  # 'pending', 'running', 'completed'

    # Model runs list
    model_runs: list[ModelRunItem]

    # Mappings
    department_mapping: DepartmentMapping

    # Permissions
    can_edit: bool
    can_delete: bool


router = APIRouter()


def parse_jsonb(data: Any) -> dict[str, Any] | list[Any] | None:  # noqa: ANN401
    """Parse JSONB data with type safety."""
    if isinstance(data, str):
        try:
            loaded = json.loads(data)
        except json.JSONDecodeError:
            return {}
        if isinstance(loaded, (dict, list)):
            return loaded
        return None
    if isinstance(data, (dict, list)):
        return data
    return None


@router.post("/detail", response_model=EvalDetailResponse)
async def get_eval_detail(
    request: EvalDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> EvalDetailResponse:
    """Get detailed eval information."""
    tags = ["evals"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return EvalDetailResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Load SQL string
        sql_query = load_sql("sql/v3/evals/get_eval_detail.sql")
        sql_params = (request.evalId, request.profileId)

        # Execute query
        result = await conn.fetchrow(sql_query, request.evalId, request.profileId)

        if not result:
            # Check if eval exists but user doesn't have department access
            eval_exists_check = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM evals WHERE id = $1)",
                request.evalId,
            )
            if eval_exists_check:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this eval. It may be restricted to other departments.",
                )
            raise HTTPException(
                status_code=404, detail=f"Eval not found: {request.evalId}"
            )

        # Parse department_ids
        raw_department_ids = result.get("department_ids")
        department_ids: list[str] | None = None
        if raw_department_ids:
            department_ids = [str(d) for d in raw_department_ids]

        # Parse department mapping
        department_mapping: DepartmentMapping = {}
        dept_mapping_data = parse_jsonb(result.get("department_mapping"))
        if isinstance(dept_mapping_data, dict):
            for dept_id, ddata in dept_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[dept_id] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Parse model_runs list
        model_runs: list[ModelRunItem] = []
        model_runs_data = parse_jsonb(result.get("model_runs"))
        if isinstance(model_runs_data, list):
            for mr_data in model_runs_data:
                if isinstance(mr_data, dict):
                    model_runs.append(
                        ModelRunItem(
                            model_run_id=str(mr_data.get("run_id", "")),
                            completed=bool(mr_data.get("completed", False)),
                            assigned_at=str(mr_data.get("assigned_at", "")),
                            status_updated_at=str(mr_data.get("status_updated_at", "")),
                            model_run_created_at=str(
                                mr_data.get("model_run_created_at", "")
                            ),
                            model_id=str(mr_data.get("model_id", ""))
                            if mr_data.get("model_id")
                            else None,
                            model_name=mr_data.get("model_name"),
                            agent_id=str(mr_data.get("agent_id", ""))
                            if mr_data.get("agent_id")
                            else None,
                            agent_name=mr_data.get("agent_name"),
                            persona_id=str(mr_data.get("persona_id", ""))
                            if mr_data.get("persona_id")
                            else None,
                            persona_name=mr_data.get("persona_name"),
                            profile_id=str(mr_data.get("profile_id", ""))
                            if mr_data.get("profile_id")
                            else None,
                            profile_name=mr_data.get("profile_name"),
                            has_grade=bool(mr_data.get("has_grade", False)),
                            grade_score=int(mr_data.get("grade_score"))
                            if mr_data.get("grade_score") is not None
                            else None,
                            grade_passed=bool(mr_data.get("grade_passed"))
                            if mr_data.get("grade_passed") is not None
                            else None,
                            grade_created_at=str(mr_data.get("grade_created_at"))
                            if mr_data.get("grade_created_at")
                            else None,
                        )
                    )

        response_data = EvalDetailResponse(
            eval_id=str(result.get("eval_id", "")),
            name=result.get("name", ""),
            description=result.get("description", ""),
            rubric_id=str(result.get("rubric_id", "")),
            rubric_name=result.get("rubric_name", ""),
            rubric_description=result.get("rubric_description", ""),
            rubric_points=int(result.get("rubric_points", 0)),
            rubric_pass_points=int(result.get("rubric_pass_points", 0)),
            created_at=str(result.get("created_at", "")),
            updated_at=str(result.get("updated_at", "")),
            department_ids=department_ids,
            total_runs=int(result.get("total_runs", 0)),
            completed_runs=int(result.get("completed_runs", 0)),
            pending_runs=int(result.get("pending_runs", 0)),
            status=str(result.get("status", "pending")),
            model_runs=model_runs,
            department_mapping=department_mapping,
            can_edit=result.get("can_edit", False),
            can_delete=result.get("can_delete", False),
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_eval_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

