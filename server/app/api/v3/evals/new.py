"""Eval new endpoint - v3 API following DHH principles."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.activity.audit import audit_activity, audit_set
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


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


class EvalNewRequest(BaseModel):
    """Request for default eval detail."""

    # profileId removed - comes from X-Profile-Id header


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
    "/new",
    response_model=EvalDetailResponse,
    dependencies=[
        audit_activity("eval.new", "{{ actor.name }} opened new eval form")
    ],
)
async def get_eval_new(
    request_body: EvalNewRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> EvalDetailResponse:
    """Get default eval detail with departments, agents, and rubrics mappings."""
    tags = ["evals"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request_body.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

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
        profile_id = request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        sql_query = load_sql("sql/v3/evals/get_eval_new_complete.sql")
        sql_params = (profile_id,)
        row = await conn.fetchrow(sql_query, profile_id)

        if not row:
            raise HTTPException(
                status_code=404, detail="Failed to get default eval data"
            )

        actor_name = row.get("actor_name")
        if actor_name:
            audit_set(request, actor={"name": actor_name, "id": profile_id})

        # Parse department_ids
        raw_department_ids = row.get("department_ids")
        department_ids: list[str] | None = None
        if raw_department_ids:
            department_ids = [str(d) for d in raw_department_ids]

        # Parse department mapping
        department_mapping: dict[str, DepartmentMappingItem] = {}
        dept_mapping_data = parse_jsonb(row.get("department_mapping"))
        if isinstance(dept_mapping_data, dict):
            for dept_id, ddata in dept_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[dept_id] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Parse eval_agent_mapping (agents with 'eval' role)
        eval_agent_mapping: AgentMapping = {}
        eval_agent_mapping_data = parse_jsonb(row.get("eval_agent_mapping"))
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

        # Parse agent_mapping (agents being evaluated)
        agent_mapping: AgentMapping = {}
        agent_mapping_data = parse_jsonb(row.get("agent_mapping"))
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

        # Merge both agent mappings (eval agents + agents for eval)
        # Prefer eval_agent_mapping entries if there's overlap
        merged_agent_mapping = {**agent_mapping, **eval_agent_mapping}

        valid_eval_agent_ids = [
            str(aid) for aid in (row.get("valid_eval_agent_ids") or [])
        ]
        valid_agent_ids = [str(aid) for aid in (row.get("valid_agent_ids") or [])]
        # Combine valid agent IDs
        all_valid_agent_ids = list(set(valid_eval_agent_ids + valid_agent_ids))

        # Parse rubric mapping
        rubric_mapping: RubricMapping = {}
        rubric_mapping_data = parse_jsonb(row.get("rubric_mapping"))
        if isinstance(rubric_mapping_data, dict):
            for rubric_id, rdata in rubric_mapping_data.items():
                if isinstance(rdata, dict):
                    rubric_mapping[rubric_id] = RubricMappingItem(
                        name=rdata.get("name", ""),
                        description=rdata.get("description", ""),
                    )

        valid_rubric_ids = [str(rid) for rid in (row.get("valid_rubric_ids") or [])]

        # Parse agent_ids (selected agents being evaluated)
        raw_agent_ids = row.get("agent_ids")
        agent_ids: list[str] = []
        if raw_agent_ids:
            agent_ids = [str(aid) for aid in raw_agent_ids]

        # Parse model_run_ids (selected model runs)
        raw_model_run_ids = row.get("model_run_ids")
        model_run_ids: list[str] = []
        if raw_model_run_ids:
            model_run_ids = [str(mrid) for mrid in raw_model_run_ids]

        response_data = EvalDetailResponse(
            eval_id=str(row.get("eval_id", "")),
            name=row.get("name", ""),
            description=row.get("description", ""),
            agent_id=None,
            eval_agent_id=str(row.get("eval_agent_id", ""))
            if row.get("eval_agent_id")
            else None,
            active=row.get("active", True),
            dynamic=row.get("dynamic", False),
            rubric_id=str(row.get("rubric_id", "")) if row.get("rubric_id") else "",
            rubric_name="",
            rubric_description="",
            rubric_points=0,
            rubric_pass_points=0,
            created_at="",
            updated_at="",
            department_ids=department_ids,
            total_runs=0,
            completed_runs=0,
            pending_runs=0,
            status="pending",
            model_runs=[],
            department_mapping=department_mapping,
            valid_department_ids=[
                str(did) for did in (row.get("valid_department_ids") or [])
            ],
            eval_agent_mapping=eval_agent_mapping if eval_agent_mapping else None,
            valid_eval_agent_ids=valid_eval_agent_ids if valid_eval_agent_ids else None,
            agent_mapping=merged_agent_mapping,
            valid_agent_ids=all_valid_agent_ids,
            rubric_mapping=rubric_mapping if rubric_mapping else None,
            valid_rubric_ids=valid_rubric_ids if valid_rubric_ids else None,
            can_edit=row.get("can_edit", False),
            can_delete=row.get("can_delete", False),
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
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="get_eval_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
