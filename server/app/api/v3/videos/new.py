"""Video new endpoint - v3 API following DHH principles."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import DepartmentMapping, DepartmentMappingItem
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class VideoNewRequest(BaseModel):
    """Request to get default video details."""

    profileId: str


# Import shared types from detail.py to avoid duplication
# Note: These are duplicated here to keep endpoints independent (DHH style)
class QuestionOptionResponse(BaseModel):
    """Option in question response."""

    option_id: str
    option_text: str
    type: str  # 'discrete' or 'freeform'
    is_correct: bool


class QuestionResponse(BaseModel):
    """Question in video detail response."""

    question_id: str
    question_text: str
    type: str  # 'choice' or 'frq'
    allow_multiple: bool
    times: list[int]  # Array of seconds when question appears
    options: list[QuestionOptionResponse]  # Only for choice questions


class ProblemStatementInfo(BaseModel):
    """Problem statement info for mapping."""

    problem_statement: str
    created_at: str
    updated_at: str


class VideoDetailResponse(BaseModel):
    """Response for video detail."""

    name: str
    length_seconds: int
    active: bool
    file_path: str
    mime_type: str
    video_url: str | None
    department_ids: list[str] | None
    valid_department_ids: list[str]
    outline_ids: list[str]
    outline_mapping: dict[str, dict[str, str]]
    problem_statement_ids: list[str]
    problem_statement_mapping: dict[str, ProblemStatementInfo]
    objective_ids: list[str]
    objective_mapping: dict[str, dict[str, str]]
    policy_ids: list[str]
    policy_mapping: dict[str, dict[str, str]]
    valid_policy_ids: list[str]
    video_images: list[dict[str, Any]]
    objectives_history: list[str]
    can_edit: bool
    can_duplicate: bool
    can_delete: bool
    department_mapping: DepartmentMapping
    questions: list[QuestionResponse]  # Empty for default
    outline_agent_id: str
    image_agent_id: str
    agent_mapping: dict[str, dict[str, Any]]  # AgentMapping format
    valid_agent_ids: list[str]
    parameter_mapping: dict[str, dict[str, Any]]
    parameter_item_mapping: dict[str, dict[str, Any]]
    parameter_item_ids: list[str]


router = APIRouter()


def parse_jsonb(data: Any) -> dict[str, Any] | list[Any] | None:
    """Parse JSONB data with type safety."""
    if isinstance(data, str):
        try:
            return json.loads(data)  # type: ignore
        except json.JSONDecodeError:
            return {}
    return data or {}


@router.post("/new", response_model=VideoDetailResponse)
async def get_video_new(
    request_data: VideoNewRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> VideoDetailResponse:
    """Get default video structure for creation mode."""
    tags = ["videos"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request_data.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return VideoDetailResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Load SQL query
        sql_query = load_sql(
            "sql/v3/videos/get_video_new_complete.sql"
        )
        sql_params = (request_data.profileId,)

        # Execute query
        result = await conn.fetchrow(sql_query, request_data.profileId)

        if not result:
            raise ValueError("Failed to fetch default video data")

        dept_ids = result["department_ids"] or []

        if not dept_ids:
            raise ValueError("No accessible departments found for user")

        # Parse department_mapping from JSONB
        department_mapping_data = parse_jsonb(result.get("department_mapping"))
        department_mapping: DepartmentMapping = {}
        if isinstance(department_mapping_data, dict):
            for did, ddata in department_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[did] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Parse problem_statement_mapping from JSONB
        problem_statement_mapping_data = parse_jsonb(result.get("problem_statement_mapping"))
        problem_statement_mapping: dict[str, ProblemStatementInfo] = {}
        if isinstance(problem_statement_mapping_data, dict):
            for k, v in problem_statement_mapping_data.items():
                if isinstance(v, dict):
                    problem_statement_mapping[k] = ProblemStatementInfo(
                        problem_statement=v.get("problem_statement", ""),
                        created_at=v.get("created_at", ""),
                        updated_at=v.get("updated_at", ""),
                    )

        # Parse policy_mapping from JSONB
        policy_mapping_data = parse_jsonb(result.get("policy_mapping"))
        policy_mapping: dict[str, dict[str, str]] = {}
        if isinstance(policy_mapping_data, dict):
            policy_mapping = {
                k: {
                    "name": v.get("name", ""),
                    "description": v.get("description", ""),
                    "extension": v.get("extension", ""),
                    "filePath": v.get("filePath", ""),
                    "mimeType": v.get("mimeType", ""),
                    "uploadId": v.get("uploadId", ""),
                }
                for k, v in policy_mapping_data.items()
            }

        # Parse valid_policy_ids
        valid_policy_ids = result.get("valid_policy_ids") or []
        if not isinstance(valid_policy_ids, list):
            valid_policy_ids = []

        # Parse objectives_history
        objectives_history = result.get("objectives_history") or []
        if not isinstance(objectives_history, list):
            objectives_history = []

        # Parse agent_mapping
        agent_mapping: dict[str, dict[str, Any]] = {}
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
                    agent_mapping[agent_id] = {
                        "name": adata.get("name", ""),
                        "description": adata.get("description", ""),
                        "roles": [str(r) for r in roles],
                    }

        valid_agent_ids = [
            str(aid) for aid in (result.get("valid_agent_ids") or [])
        ]

        # Parse parameter_mapping from JSONB
        parameter_mapping_data = parse_jsonb(result.get("parameter_mapping"))
        parameter_mapping: dict[str, dict[str, Any]] = {}
        if isinstance(parameter_mapping_data, dict):
            parameter_mapping = {
                k: {
                    "name": v.get("name", ""),
                    "description": v.get("description", ""),
                    "numerical": bool(v.get("numerical", False)),
                    "policy_parameter": bool(v.get("policy_parameter", False)),
                    "video_parameter": bool(v.get("video_parameter", False)),
                }
                for k, v in parameter_mapping_data.items()
                if isinstance(v, dict)
            }

        # Parse parameter_item_mapping from JSONB
        parameter_item_mapping_data = parse_jsonb(result.get("parameter_item_mapping"))
        parameter_item_mapping: dict[str, dict[str, Any]] = {}
        if isinstance(parameter_item_mapping_data, dict):
            parameter_item_mapping = {
                k: {
                    "name": v.get("name", ""),
                    "description": v.get("description", ""),
                    "parameter_id": str(v.get("parameter_id", "")),
                    "parameter_name": v.get("parameter_name", ""),
                    "value": v.get("value"),
                }
                for k, v in parameter_item_mapping_data.items()
                if isinstance(v, dict)
            }

        # Parse parameter_item_ids
        parameter_item_ids = result.get("parameter_item_ids") or []
        if not isinstance(parameter_item_ids, list):
            parameter_item_ids = []
        parameter_item_ids = [str(pid) for pid in parameter_item_ids]

        # Get user role and primary department for default behavior
        user_role = str(result.get("user_role", "")).lower()
        is_superadmin = user_role == "superadmin"
        primary_department_id = result.get("primary_department_id")

        # Set default department_ids based on role
        # Superadmin: None (empty = all departments = default object)
        # Non-superadmin: [primaryDepartmentId] if available
        if is_superadmin:
            default_department_ids = None
        else:
            default_department_ids = (
                [primary_department_id] if primary_department_id else []
            )

        is_default = default_department_ids is None or len(default_department_ids) == 0

        # For default videos, only superadmin can edit
        can_edit_default = not (is_default and not is_superadmin)

        response_data = VideoDetailResponse(
            # Basic fields (empty defaults)
            name="",
            length_seconds=0,
            active=True,
            file_path="",
            mime_type="",
            video_url=None,
            # Department
            department_ids=default_department_ids,
            valid_department_ids=dept_ids,
            # Problem statement and objectives (empty for default)
            outline_ids=[],
            outline_mapping={},
            problem_statement_ids=[],
            problem_statement_mapping=problem_statement_mapping,
            objective_ids=[],
            objective_mapping={},
            # Policies (empty for default)
            policy_ids=[],
            policy_mapping=policy_mapping,
            valid_policy_ids=[str(pid) for pid in valid_policy_ids],
            # Video images (empty for default)
            video_images=[],
            # Objectives history
            objectives_history=[str(obj) for obj in objectives_history],
            # Permissions (check if default video and user role)
            can_edit=can_edit_default,
            can_duplicate=False,  # Can't duplicate non-existent video
            can_delete=False,  # Can't delete non-existent video
            # Mappings
            department_mapping=department_mapping,
            # Questions (empty for create mode)
            questions=[],
            # Agents (empty IDs for new video, but include mapping and valid IDs)
            outline_agent_id="",
            image_agent_id="",
            agent_mapping=agent_mapping,
            valid_agent_ids=valid_agent_ids,
            # Parameters (empty for new video)
            parameter_mapping=parameter_mapping,
            parameter_item_mapping=parameter_item_mapping,
            parameter_item_ids=parameter_item_ids,
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
            route_path=request.url.path,
            operation="get_video_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

