"""Eval detail endpoint - v3 API following DHH principles."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import load_sql


# Inline mapping types (DHH style - no shared types)
class DepartmentMappingItem(BaseModel):
    """Department mapping item."""

    name: str
    description: str


class AgentMappingItem(BaseModel):
    """Agent mapping item with role information."""

    name: str
    description: str
    roles: list[str] = []


class RubricMappingItem(BaseModel):
    """Rubric mapping item."""

    name: str
    description: str


# Type aliases for Dict mappings
DepartmentMapping = dict[str, DepartmentMappingItem]
AgentMapping = dict[str, AgentMappingItem]
RubricMapping = dict[str, RubricMappingItem]


# Inline request/response schemas
class EvalDetailRequest(BaseModel):
    """Request to get eval details."""

    evalId: str
    # profileId removed - comes from X-Profile-Id header


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
    agent_id: str | None  # Agent being evaluated
    eval_agent_id: str | None  # Agent performing evaluation
    active: bool
    dynamic: bool
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
    department_mapping: dict[str, DepartmentMappingItem]
    valid_department_ids: list[str]
    eval_agent_mapping: (
        dict[str, AgentMappingItem] | None
    )  # Eval agent mapping (agents with 'eval' role)
    valid_eval_agent_ids: list[str] | None
    agent_mapping: dict[
        str, AgentMappingItem
    ]  # AgentMapping format (agents being evaluated)
    valid_agent_ids: list[str]
    rubric_mapping: (
        dict[str, RubricMappingItem] | None
    )  # Rubric mapping (filtered by agent role)
    valid_rubric_ids: list[str] | None

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


@router.post(
    "/detail",
    response_model=EvalDetailResponse,
    dependencies=[
        audit_activity("eval.viewed", "{{ actor.name }} viewed eval '{{ eval.name }}'")
    ],
)
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
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Load SQL string
        sql_query = load_sql("app/sql/v3/evals/get_eval_detail.sql")
        sql_params = (request.evalId, profile_id)

        # Execute query
        result = await conn.fetchrow(sql_query, request.evalId, profile_id)

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

        # Set audit context with data from SQL query
        actor_name = result.get("actor_name")
        eval_name = result.get("name")
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                eval={"name": eval_name, "id": request.evalId},
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

        # Parse eval_agent_mapping (agents with 'eval' role)
        eval_agent_mapping: AgentMapping = {}
        eval_agent_mapping_data = parse_jsonb(result.get("eval_agent_mapping"))
        if isinstance(eval_agent_mapping_data, dict):
            for agent_id, adata in eval_agent_mapping_data.items():
                if isinstance(adata, dict):
                    roles = adata.get("roles", [])
                    if isinstance(roles, str):
                        try:
                            roles = json.loads(roles)
                        except json.JSONDecodeError:
                            roles = []
                    if not isinstance(roles, list):
                        roles = []
                    eval_agent_mapping[agent_id] = AgentMappingItem(
                        name=adata.get("name", ""),
                        description=adata.get("description", ""),
                        roles=[str(r) for r in roles],
                    )

        valid_eval_agent_ids = [
            str(aid) for aid in (result.get("valid_eval_agent_ids") or [])
        ]

        # Parse agent_mapping (agents being evaluated)
        agent_mapping: AgentMapping = {}
        agent_mapping_data = parse_jsonb(result.get("agent_mapping"))
        if isinstance(agent_mapping_data, dict):
            for agent_id, adata in agent_mapping_data.items():
                if isinstance(adata, dict):
                    roles = adata.get("roles", [])
                    if isinstance(roles, str):
                        try:
                            roles = json.loads(roles)
                        except json.JSONDecodeError:
                            roles = []
                    if not isinstance(roles, list):
                        roles = []
                    agent_mapping[agent_id] = AgentMappingItem(
                        name=adata.get("name", ""),
                        description=adata.get("description", ""),
                        roles=[str(r) for r in roles],
                    )

        valid_agent_ids = [str(aid) for aid in (result.get("valid_agent_ids") or [])]
        valid_department_ids = [
            str(did) for did in (result.get("valid_department_ids") or [])
        ]

        # Parse rubric mapping
        rubric_mapping: RubricMapping = {}
        rubric_mapping_data = parse_jsonb(result.get("rubric_mapping"))
        if isinstance(rubric_mapping_data, dict):
            for rubric_id, rdata in rubric_mapping_data.items():
                if isinstance(rdata, dict):
                    rubric_mapping[rubric_id] = RubricMappingItem(
                        name=rdata.get("name", ""),
                        description=rdata.get("description", ""),
                    )

        valid_rubric_ids = [str(rid) for rid in (result.get("valid_rubric_ids") or [])]

        # Parse model_runs list
        model_runs: list[ModelRunItem] = []
        model_runs_data = parse_jsonb(result.get("model_runs"))
        if isinstance(model_runs_data, list):
            for mr_data in model_runs_data:
                if isinstance(mr_data, dict):
                    grade_score_val = mr_data.get("grade_score")
                    grade_score: int | None = None
                    if grade_score_val is not None and grade_score_val != "":
                        try:
                            if isinstance(grade_score_val, (int, float, str)):
                                grade_score = int(grade_score_val)
                        except (ValueError, TypeError):
                            grade_score = None

                    grade_passed_val = mr_data.get("grade_passed")
                    grade_passed: bool | None = None
                    if grade_passed_val is not None:
                        grade_passed = bool(grade_passed_val)

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
                            grade_score=grade_score,
                            grade_passed=grade_passed,
                            grade_created_at=str(mr_data.get("grade_created_at"))
                            if mr_data.get("grade_created_at")
                            else None,
                        )
                    )

        agent_id_val = result.get("agent_id")
        eval_agent_id_val = result.get("eval_agent_id")

        response_data = EvalDetailResponse(
            eval_id=str(result.get("eval_id", "")),
            name=result.get("name", ""),
            description=result.get("description", ""),
            rubric_id=str(result.get("rubric_id", "")),
            agent_id=str(agent_id_val) if agent_id_val else None,
            eval_agent_id=str(eval_agent_id_val) if eval_agent_id_val else None,
            active=result.get("active", True),
            dynamic=result.get("dynamic", False),
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
            valid_department_ids=valid_department_ids,
            eval_agent_mapping=eval_agent_mapping if eval_agent_mapping else None,
            valid_eval_agent_ids=valid_eval_agent_ids if valid_eval_agent_ids else None,
            agent_mapping=agent_mapping,
            valid_agent_ids=valid_agent_ids,
            rubric_mapping=rubric_mapping if rubric_mapping else None,
            valid_rubric_ids=valid_rubric_ids if valid_rubric_ids else None,
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
