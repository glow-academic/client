"""Prompt detail endpoint - v3 API following DHH principles."""

import json
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import DepartmentMappingItem
from app.utils.sql_helper import load_sql


class PromptDetailRequest(BaseModel):
    """Request for prompt detail."""

    promptId: str
    profileId: str


class PromptDetailResponse(BaseModel):
    """Response for prompt detail endpoint."""

    prompt_id: str
    name: str
    description: str | None = None
    active: bool
    system_prompt: str
    created_at: str
    updated_at: str
    department_ids: list[str]
    agent_ids: list[str]
    persona_ids: list[str]
    valid_department_ids: list[str]
    can_edit: bool
    department_mapping: dict[str, DepartmentMappingItem]
    agent_mapping: dict[str, dict[str, str]]
    persona_mapping: dict[str, dict[str, str]]


router = APIRouter()


@router.post("/detail", response_model=PromptDetailResponse)
async def get_prompt_detail(
    request_body: PromptDetailRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PromptDetailResponse:
    """Get prompt detail information."""
    tags = ["prompts"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request_body.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return PromptDetailResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/prompts/get_prompt_detail_complete.sql")
        sql_params = (
            uuid.UUID(request_body.promptId),
            uuid.UUID(request_body.profileId),
        )
        row = await conn.fetchrow(
            sql_query,
            uuid.UUID(request_body.promptId),
            uuid.UUID(request_body.profileId),
        )

        if not row:
            # Check if prompt exists but user doesn't have department access
            prompt_exists_check = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM prompts WHERE id = $1)",
                uuid.UUID(request_body.promptId),
            )
            if prompt_exists_check:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this prompt. It may be restricted to other departments.",
                )
            raise HTTPException(status_code=404, detail="Prompt not found")

        # Parse department mapping
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

        # Parse agent mapping
        agent_mapping: dict[str, dict[str, str]] = {}
        if row.get("agent_mapping"):
            agent_data = row["agent_mapping"]
            if isinstance(agent_data, str):
                agent_data = json.loads(agent_data)
            if isinstance(agent_data, dict):
                agent_mapping = agent_data

        # Parse persona mapping
        persona_mapping: dict[str, dict[str, str]] = {}
        if row.get("persona_mapping"):
            persona_data = row["persona_mapping"]
            if isinstance(persona_data, str):
                persona_data = json.loads(persona_data)
            if isinstance(persona_data, dict):
                persona_mapping = persona_data

        # Get can_edit from SQL (handles default objects and role checks)
        can_edit = row.get("can_edit", False)

        # Convert arrays
        valid_department_ids = [
            str(did) for did in (row.get("valid_department_ids") or [])
        ]
        dept_ids = []
        if row.get("department_ids"):
            dept_ids = [str(d) for d in row["department_ids"]]

        agent_ids = []
        if row.get("agent_ids"):
            agent_ids = [str(aid) for aid in row["agent_ids"]]

        persona_ids = []
        if row.get("persona_ids"):
            persona_ids = [str(pid) for pid in row["persona_ids"]]

        response_data = PromptDetailResponse(
            prompt_id=str(row.get("prompt_id", "")),
            name=row.get("name") or "",
            description=row.get("description"),
            active=row.get("active", False),
            system_prompt=row.get("system_prompt", ""),
            created_at=row.get("created_at").isoformat()
            if row.get("created_at")
            else "",
            updated_at=row.get("updated_at").isoformat()
            if row.get("updated_at")
            else "",
            department_ids=dept_ids,
            agent_ids=agent_ids,
            persona_ids=persona_ids,
            valid_department_ids=valid_department_ids,
            can_edit=can_edit,
            department_mapping=department_mapping,
            agent_mapping=agent_mapping,
            persona_mapping=persona_mapping,
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
            operation="get_prompt_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
