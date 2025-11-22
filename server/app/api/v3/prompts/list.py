"""Prompts list endpoint - v3 API following DHH principles."""

import json
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


class PromptsListRequest(BaseModel):
    """Request for prompts list."""

    profileId: str


class PromptItem(BaseModel):
    """Prompt item for list view."""

    prompt_id: str
    name: str
    description: str | None = None
    active: bool
    system_prompt_preview: str
    system_prompt: str
    created_at: str
    updated_at: str
    department_ids: list[str] | None = None
    agent_ids: list[str]
    persona_ids: list[str]
    can_edit: bool
    can_delete: bool


class PromptsListResponse(BaseModel):
    """Response for prompts list."""

    prompts: list[PromptItem]
    department_options: list[dict[str, str]]
    agent_options: list[dict[str, str]]
    persona_options: list[dict[str, str]]
    department_mapping: dict[str, DepartmentMappingItem]
    agent_mapping: dict[str, dict[str, str]]
    persona_mapping: dict[str, dict[str, str]]


router = APIRouter()


@router.post("/list", response_model=PromptsListResponse)
async def get_prompts_list(
    filters: PromptsListRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PromptsListResponse:
    """Get prompts list with permissions and relationships."""
    tags = ["prompts"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return PromptsListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/prompts/list_prompts.sql")
        sql_params = (filters.profileId,)
        rows = await conn.fetch(sql_query, filters.profileId)

        prompts = []
        department_mapping: dict[str, DepartmentMappingItem] = {}
        agent_mapping: dict[str, dict[str, str]] = {}
        persona_mapping: dict[str, dict[str, str]] = {}
        department_options: list[dict[str, str]] = []
        agent_options: list[dict[str, str]] = []
        persona_options: list[dict[str, str]] = []

        for row in rows:
            # Convert UUID arrays to string arrays
            department_ids = None
            if row.get("department_ids"):
                department_ids = [str(did) for did in row["department_ids"]]

            agent_ids = [str(aid) for aid in (row.get("agent_ids") or [])]
            persona_ids = [str(pid) for pid in (row.get("persona_ids") or [])]

            prompts.append(
                PromptItem(
                    prompt_id=str(row["prompt_id"]),
                    name=row.get("name") or "",
                    description=row.get("description"),
                    active=row.get("active", False),
                    system_prompt_preview=row["system_prompt_preview"] or "",
                    system_prompt=row["system_prompt"] or "",
                    created_at=row["created_at"].isoformat() if row.get("created_at") else "",
                    updated_at=row["updated_at"].isoformat() if row.get("updated_at") else "",
                    department_ids=department_ids,
                    agent_ids=agent_ids,
                    persona_ids=persona_ids,
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                )
            )

            # Parse mappings from first row (same for all prompts)
            if not department_mapping and row.get("department_mapping"):
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

            if not agent_mapping and row.get("agent_mapping"):
                agent_data = row["agent_mapping"]
                if isinstance(agent_data, str):
                    agent_data = json.loads(agent_data)
                if isinstance(agent_data, dict):
                    agent_mapping = agent_data

            if not persona_mapping and row.get("persona_mapping"):
                persona_data = row["persona_mapping"]
                if isinstance(persona_data, str):
                    persona_data = json.loads(persona_data)
                if isinstance(persona_data, dict):
                    persona_mapping = persona_data

            # Parse facet options from first row
            if not department_options and row.get("department_options"):
                dept_opts = row["department_options"]
                if isinstance(dept_opts, str):
                    dept_opts = json.loads(dept_opts)
                if isinstance(dept_opts, list):
                    department_options = dept_opts

            if not agent_options and row.get("agent_options"):
                agent_opts = row["agent_options"]
                if isinstance(agent_opts, str):
                    agent_opts = json.loads(agent_opts)
                if isinstance(agent_opts, list):
                    agent_options = agent_opts

            if not persona_options and row.get("persona_options"):
                persona_opts = row["persona_options"]
                if isinstance(persona_opts, str):
                    persona_opts = json.loads(persona_opts)
                if isinstance(persona_opts, list):
                    persona_options = persona_opts

        response_data = PromptsListResponse(
            prompts=prompts,
            department_options=department_options,
            agent_options=agent_options,
            persona_options=persona_options,
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
            operation="get_prompts_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

