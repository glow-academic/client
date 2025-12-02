"""Video detail endpoint - v3 API following DHH principles."""

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
class VideoDetailRequest(BaseModel):
    """Request to get video detail."""

    videoId: str
    profileId: str


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
    questions: list[QuestionResponse]
    outline_agent_id: str
    question_agent_id: str
    image_agent_id: str
    agent_mapping: dict[str, dict[str, Any]]  # AgentMapping format
    valid_agent_ids: list[str]


router = APIRouter()


def parse_jsonb(data: Any) -> dict[str, Any] | list[Any] | None:
    """Parse JSONB data with type safety."""
    if isinstance(data, str):
        try:
            parsed = json.loads(data)  # type: ignore[no-any-return]
            if isinstance(parsed, dict):
                return parsed
            if isinstance(parsed, list):
                return parsed
            return {}
        except json.JSONDecodeError:
            return {}
    if isinstance(data, dict):
        return data
    if isinstance(data, list):
        return data
    return None


@router.post("/detail", response_model=VideoDetailResponse)
async def get_video_detail(
    request_data: VideoDetailRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> VideoDetailResponse:
    """Get detailed video information."""
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
        # Load SQL string
        sql_query = load_sql("sql/v3/videos/get_video_detail_complete.sql")
        sql_params = (request_data.videoId, request_data.profileId)

        # Execute query
        video = await conn.fetchrow(
            sql_query, request_data.videoId, request_data.profileId
        )
        if not video:
            # Check if video exists but user doesn't have department access
            video_exists_check = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM videos WHERE id = $1)",
                request_data.videoId,
            )
            if video_exists_check:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this video. It may be restricted to other departments.",
                )
            raise HTTPException(
                status_code=404, detail=f"Video not found: {request_data.videoId}"
            )

        # Parse department_mapping from JSONB
        department_mapping_data = parse_jsonb(video.get("department_mapping"))
        department_mapping: DepartmentMapping = {}
        if isinstance(department_mapping_data, dict):
            for did, ddata in department_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[did] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Parse questions from JSONB into strongly typed models
        questions_data = parse_jsonb(video.get("questions"))
        questions: list[QuestionResponse] = []
        if isinstance(questions_data, list):
            for q_data in questions_data:
                if isinstance(q_data, dict):
                    options: list[QuestionOptionResponse] = []
                    if isinstance(q_data.get("options"), list):
                        for opt_data in q_data.get("options", []):
                            if isinstance(opt_data, dict):
                                options.append(
                                    QuestionOptionResponse(
                                        option_id=str(opt_data.get("option_id", "")),
                                        option_text=str(opt_data.get("option_text", "")),
                                        type=str(opt_data.get("type", "discrete")),
                                        is_correct=bool(opt_data.get("is_correct", False)),
                                    )
                                )
                    times = q_data.get("times", [])
                    if not isinstance(times, list):
                        times = []
                    questions.append(
                        QuestionResponse(
                            question_id=str(q_data.get("question_id", "")),
                            question_text=str(q_data.get("question_text", "")),
                            type=str(q_data.get("type", "choice")),
                            allow_multiple=bool(q_data.get("allow_multiple", False)),
                            times=[int(t) for t in times if isinstance(t, (int, str)) and str(t).isdigit()],
                            options=options,
                        )
                    )
        elif questions_data is None:
            questions = []

        dept_ids = None
        if video.get("department_ids"):
            dept_ids = [str(d) for d in video["department_ids"]]

        valid_dept_ids = video.get("valid_department_ids") or []
        if not isinstance(valid_dept_ids, list):
            valid_dept_ids = []

        # Parse problem_statement_mapping from JSONB
        problem_statement_mapping_data = parse_jsonb(video.get("problem_statement_mapping"))
        problem_statement_mapping: dict[str, ProblemStatementInfo] = {}
        if isinstance(problem_statement_mapping_data, dict):
            for k, v in problem_statement_mapping_data.items():
                if isinstance(v, dict):
                    problem_statement_mapping[k] = ProblemStatementInfo(
                        problem_statement=v.get("problem_statement", ""),
                        created_at=v.get("created_at", ""),
                        updated_at=v.get("updated_at", ""),
                    )

        # Parse objective_mapping from JSONB
        objective_mapping_data = parse_jsonb(video.get("objective_mapping"))
        objective_mapping: dict[str, dict[str, str]] = {}
        if isinstance(objective_mapping_data, dict):
            objective_mapping = {
                k: {"name": v.get("name", ""), "description": v.get("description", "")}
                for k, v in objective_mapping_data.items()
            }

        # Parse outline_mapping from JSONB
        outline_mapping_data = parse_jsonb(video.get("outline_mapping"))
        outline_mapping: dict[str, dict[str, str]] = {}
        if isinstance(outline_mapping_data, dict):
            outline_mapping = {
                k: {
                    "name": v.get("name", ""),
                    "outline": v.get("outline", ""),
                    "created_at": v.get("created_at", ""),
                    "updated_at": v.get("updated_at", ""),
                }
                for k, v in outline_mapping_data.items()
            }

        # Parse policy_mapping from JSONB
        policy_mapping_data = parse_jsonb(video.get("policy_mapping"))
        policy_mapping: dict[str, dict[str, str]] = {}
        if isinstance(policy_mapping_data, dict):
            policy_mapping = {
                k: {
                    "name": v.get("name", ""),
                    "description": v.get("description", ""),
                    "extension": v.get("extension", ""),
                    "filePath": v.get("filePath", ""),
                    "mimeType": v.get("mimeType", ""),
                }
                for k, v in policy_mapping_data.items()
            }

        # Parse video_images from JSONB
        video_images_data = parse_jsonb(video.get("video_images"))
        video_images: list[dict[str, Any]] = []
        if isinstance(video_images_data, list):
            video_images = [
                {
                    "id": img.get("id", ""),
                    "name": img.get("name", ""),
                    "file_path": img.get("file_path", ""),
                    "mime_type": img.get("mime_type", ""),
                    "active": img.get("active", True),
                }
                for img in video_images_data
                if isinstance(img, dict)
            ]

        outline_ids = video.get("outline_ids") or []
        if not isinstance(outline_ids, list):
            outline_ids = []

        problem_statement_ids = video.get("problem_statement_ids") or []
        if not isinstance(problem_statement_ids, list):
            problem_statement_ids = []
        
        objective_ids = video.get("objective_ids") or []
        if not isinstance(objective_ids, list):
            objective_ids = []
        
        policy_ids = video.get("policy_ids") or []
        if not isinstance(policy_ids, list):
            policy_ids = []

        valid_policy_ids = video.get("valid_policy_ids") or []
        if not isinstance(valid_policy_ids, list):
            valid_policy_ids = []

        # Parse objectives_history
        objectives_history = video.get("objectives_history") or []
        if not isinstance(objectives_history, list):
            objectives_history = []

        # Parse agent_mapping
        agent_mapping: dict[str, dict[str, Any]] = {}
        agent_mapping_data = parse_jsonb(video.get("agent_mapping"))
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
            str(aid) for aid in (video.get("valid_agent_ids") or [])
        ]

        # Extract file_path and mime_type
        file_path = video.get("file_path") or ""
        mime_type = video.get("mime_type") or ""
        
        # Construct video_url if file_path exists and is not empty
        video_url = None
        if file_path and file_path.strip():
            video_url = f"/api/videos/download/{request_data.videoId}"

        response_data = VideoDetailResponse(
            name=video["name"],
            length_seconds=video["length_seconds"],
            active=video["active"],
            file_path=file_path,
            mime_type=mime_type,
            video_url=video_url,
            department_ids=dept_ids,
            valid_department_ids=[str(did) for did in valid_dept_ids],
            outline_ids=[str(oid) for oid in outline_ids],
            outline_mapping=outline_mapping,
            problem_statement_ids=[str(psid) for psid in problem_statement_ids],
            problem_statement_mapping=problem_statement_mapping,
            objective_ids=[str(oid) for oid in objective_ids],
            objective_mapping=objective_mapping,
            policy_ids=[str(pid) for pid in policy_ids],
            policy_mapping=policy_mapping,
            valid_policy_ids=[str(pid) for pid in valid_policy_ids],
            video_images=video_images,
            objectives_history=[str(obj) for obj in objectives_history],
            can_edit=video["can_edit"],
            can_duplicate=video["can_duplicate"],
            can_delete=video["can_delete"],
            department_mapping=department_mapping,
            questions=questions,
            outline_agent_id=video.get("outline_agent_id", ""),
            question_agent_id=video.get("question_agent_id", ""),
            image_agent_id=video.get("image_agent_id", ""),
            agent_mapping=agent_mapping,
            valid_agent_ids=valid_agent_ids,
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
            operation="get_video_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

