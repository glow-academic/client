"""Evals list endpoint - v3 API following DHH principles."""

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


# Type alias for Dict mapping
DepartmentMapping = dict[str, DepartmentMappingItem]


# Inline request/response schemas
class EvalsFilters(BaseModel):
    """Filters for evals list request."""

    # profileId removed - comes from X-Profile-Id header


class EvalItem(BaseModel):
    """Individual eval item in the response."""

    eval_id: str
    name: str
    description: str
    rubric_id: str
    agent_id: str
    rubric_name: str
    rubric_description: str
    total_runs: int
    completed_runs: int
    pending_runs: int
    status: str  # 'pending', 'running', 'completed'
    created_at: str
    updated_at: str
    department_ids: list[str] | None
    can_edit: bool
    can_delete: bool


class StandardGroupMappingItem(BaseModel):
    """Standard group mapping item with rubric context."""

    name: str
    description: str
    points: int
    passPoints: int


class StandardMappingItem(BaseModel):
    """Standard mapping item with points."""

    name: str
    description: str
    points: int


# Type aliases for Dict mappings
StandardGroupsMapping = dict[str, StandardGroupMappingItem]
StandardsMapping = dict[str, StandardMappingItem]


class EvalsListResponse(BaseModel):
    """Response for evals list endpoint."""

    evals: list[EvalItem]
    rubric_mapping: dict[str, dict[str, Any]]
    department_mapping: DepartmentMapping
    agent_mapping: dict[str, dict[str, Any]]
    standard_groups_mapping: StandardGroupsMapping
    standards_mapping: StandardsMapping
    rubric_standard_groups_mapping: dict[
        str, dict[str, list[str]]
    ]  # Maps rubric_id to {standard_group_id: [standard_ids]}
    rubric_options: list[dict[str, str]]  # Array of {value, label}
    department_options: list[dict[str, str]]  # Array of {value, label}
    agent_options: list[dict[str, str]]  # Array of {value, label}


router = APIRouter()


@router.post(
    "/list",
    response_model=EvalsListResponse,
    dependencies=[
        audit_activity("evals.list", "{{ actor.name }} visited the Evals page")
    ],
)
async def get_evals_list(
    filters: EvalsFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> EvalsListResponse:
    """Get evals list with status derivation and permissions."""
    tags = ["evals"]  # From router tags

    # Check for cache bypass header (for testing)
    bypass_cache = request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return EvalsListResponse.model_validate(cached["data"])

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

        # Load SQL string
        sql_query = load_sql("app/sql/v3/evals/list_evals.sql")
        sql_params = (profile_id,)

        # Execute query
        result = await conn.fetch(sql_query, profile_id)

        # Build response - transform database rows
        evals = []
        rubric_mapping: dict[str, dict[str, Any]] = {}
        department_mapping: DepartmentMapping = {}
        agent_mapping: dict[str, dict[str, Any]] = {}
        standard_groups_mapping: StandardGroupsMapping = {}
        standards_mapping: StandardsMapping = {}
        rubric_standard_groups_mapping: dict[str, dict[str, str]] = {}

        # Get actor_name from first row (same for all rows)
        actor_name = result[0]["actor_name"] if result else None

        # Set audit context
        if actor_name:
            audit_set(request, actor={"name": actor_name, "id": profile_id})

        # Parse mappings from first row (same across all rows)
        if result:
            first_row = result[0]

            # Parse rubric mapping from JSONB
            rubric_mapping_data = first_row.get("rubric_mapping")
            if isinstance(rubric_mapping_data, str):
                rubric_mapping_data = json.loads(rubric_mapping_data)
            if rubric_mapping_data and isinstance(rubric_mapping_data, dict):
                rubric_mapping = rubric_mapping_data

            # Parse department_mapping from JSONB
            department_mapping_data = first_row.get("department_mapping")
            if isinstance(department_mapping_data, str):
                department_mapping_data = json.loads(department_mapping_data)
            if department_mapping_data and isinstance(department_mapping_data, dict):
                for did, ddata in department_mapping_data.items():
                    if isinstance(ddata, dict):
                        department_mapping[did] = DepartmentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                        )

            # Parse agent_mapping from JSONB
            agent_mapping_data = first_row.get("agent_mapping")
            if isinstance(agent_mapping_data, str):
                agent_mapping_data = json.loads(agent_mapping_data)
            if agent_mapping_data and isinstance(agent_mapping_data, dict):
                agent_mapping = agent_mapping_data

            # Parse standard_groups_mapping from JSONB
            standard_groups_mapping_data = first_row.get("standard_groups_mapping")
            if isinstance(standard_groups_mapping_data, str):
                standard_groups_mapping_data = json.loads(standard_groups_mapping_data)
            if standard_groups_mapping_data and isinstance(
                standard_groups_mapping_data, dict
            ):
                for sgid, sgdata in standard_groups_mapping_data.items():
                    if isinstance(sgdata, dict):
                        standard_groups_mapping[sgid] = StandardGroupMappingItem(
                            name=sgdata.get("name", ""),
                            description=sgdata.get("description", ""),
                            points=int(sgdata.get("points", 0)),
                            passPoints=int(sgdata.get("passPoints", 0)),
                        )

            # Parse standards_mapping from JSONB
            standards_mapping_data = first_row.get("standards_mapping")
            if isinstance(standards_mapping_data, str):
                standards_mapping_data = json.loads(standards_mapping_data)
            if standards_mapping_data and isinstance(standards_mapping_data, dict):
                for sid, sdata in standards_mapping_data.items():
                    if isinstance(sdata, dict):
                        standards_mapping[sid] = StandardMappingItem(
                            name=sdata.get("name", ""),
                            description=sdata.get("description", ""),
                            points=int(sdata.get("points", 0)),
                        )

            # Parse rubric_standard_groups_mapping from JSONB
            rubric_standard_groups_mapping_data = first_row.get(
                "rubric_standard_groups_mapping"
            )
            if isinstance(rubric_standard_groups_mapping_data, str):
                rubric_standard_groups_mapping_data = json.loads(
                    rubric_standard_groups_mapping_data
                )
            if rubric_standard_groups_mapping_data and isinstance(
                rubric_standard_groups_mapping_data, dict
            ):
                rubric_standard_groups_mapping = rubric_standard_groups_mapping_data

        # Build eval items
        for row in result:
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            evals.append(
                EvalItem(
                    eval_id=str(row["eval_id"]),
                    name=row["name"],
                    description=row["description"],
                    rubric_id=str(row["rubric_id"]),
                    agent_id=str(row.get("agent_id", "")),
                    rubric_name=row["rubric_name"],
                    rubric_description=row.get("rubric_description") or "",
                    total_runs=int(row["total_runs"]),
                    completed_runs=int(row["completed_runs"]),
                    pending_runs=int(row["pending_runs"]),
                    status=str(row["status"]),
                    created_at=str(row["created_at"]),
                    updated_at=str(row["updated_at"]),
                    department_ids=dept_ids,
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                )
            )

        # Build facet options
        rubric_options = [
            {"value": rid, "label": rdata.get("name", "")}
            for rid, rdata in rubric_mapping.items()
        ]
        # Collect all department IDs actually assigned to evals
        assigned_department_ids = set()
        for eval_item in evals:
            if eval_item.department_ids:
                assigned_department_ids.update(eval_item.department_ids)
        # Filter department_options to only include departments assigned to at least one eval
        department_options = [
            {"value": did, "label": d.name or did}
            for (did, d) in department_mapping.items()
            if did in assigned_department_ids
        ]
        # Collect all agent IDs actually assigned to evals
        assigned_agent_ids = set()
        for eval_item in evals:
            if eval_item.agent_id:
                assigned_agent_ids.add(eval_item.agent_id)
        # Filter agent_options to only include agents assigned to at least one eval
        agent_options = [
            {"value": aid, "label": adata.get("name", "")}
            for (aid, adata) in agent_mapping.items()
            if aid in assigned_agent_ids
        ]

        response_data = EvalsListResponse(
            evals=evals,
            rubric_mapping=rubric_mapping,
            department_mapping=department_mapping,
            agent_mapping=agent_mapping,
            standard_groups_mapping=standard_groups_mapping,
            standards_mapping=standards_mapping,
            rubric_standard_groups_mapping=rubric_standard_groups_mapping,
            rubric_options=rubric_options,
            department_options=department_options,
            agent_options=agent_options,
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
            operation="get_evals_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
