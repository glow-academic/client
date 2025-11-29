"""Evals model_runs query endpoint - v3 API following DHH principles."""

import json
import uuid
from datetime import datetime
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter()


# Inline request/response schemas
class ModelRunsFilters(BaseModel):
    """Filters for model_runs query request."""

    profileId: str
    startDate: str | None = None
    endDate: str | None = None
    modelIds: list[str] | None = None
    agentIds: list[str] | None = None
    personaIds: list[str] | None = None
    agentType: str | None = None  # 'agent' or 'persona'
    search: str | None = None
    page: int | None = None
    pageSize: int | None = None


class ModelRunItem(BaseModel):
    """Model run item for selection."""

    model_run_id: str
    created_at: str
    model_id: str | None
    model_name: str | None
    profile_id: str | None
    profile_name: str | None
    agent_id: str | None
    agent_name: str | None
    persona_id: str | None
    persona_name: str | None
    actor_type: str | None  # 'agent' or 'persona'


class ModelRunsResponse(BaseModel):
    """Response for model_runs query endpoint."""

    model_runs: list[ModelRunItem]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    model_mapping: dict[str, dict[str, str]]
    agent_mapping: dict[str, str]
    persona_mapping: dict[str, str]


@router.post("/model_runs", response_model=ModelRunsResponse)
async def get_model_runs(
    filters: ModelRunsFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ModelRunsResponse:
    """Get paginated, filtered model_runs for eval selection."""
    tags = ["evals"]  # From router tags

    # Check for cache bypass header
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
            return ModelRunsResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Parse dates
        start_date = None
        if filters.startDate:
            try:
                start_date = datetime.fromisoformat(filters.startDate.replace("Z", "+00:00"))
            except ValueError:
                pass

        end_date = None
        if filters.endDate:
            try:
                end_date = datetime.fromisoformat(filters.endDate.replace("Z", "+00:00"))
            except ValueError:
                pass

        # Convert filter lists to UUID arrays
        model_ids = None
        if filters.modelIds:
            model_ids = [uuid.UUID(mid) for mid in filters.modelIds]

        agent_ids = None
        if filters.agentIds:
            agent_ids = [uuid.UUID(aid) for aid in filters.agentIds]

        persona_ids = None
        if filters.personaIds:
            persona_ids = [uuid.UUID(pid) for pid in filters.personaIds]

        # Load SQL string
        sql_query = load_sql("sql/v3/evals/query_model_runs.sql")
        sql_params = (
            filters.profileId,
            start_date,
            end_date,
            model_ids,
            agent_ids,
            persona_ids,
            filters.agentType,
            filters.search,
            filters.page or 1,
            filters.pageSize or 50,
        )

        # Execute query
        result = await conn.fetchrow(sql_query, *sql_params)

        if not result:
            raise HTTPException(status_code=500, detail="Failed to query model_runs")

        # Parse model_runs list
        model_runs: list[ModelRunItem] = []
        model_runs_data = result.get("model_runs")
        if isinstance(model_runs_data, str):
            model_runs_data = json.loads(model_runs_data)
        if isinstance(model_runs_data, list):
            for mr_data in model_runs_data:
                if isinstance(mr_data, dict):
                    model_runs.append(
                        ModelRunItem(
                            model_run_id=str(mr_data.get("model_run_id", "")),
                            created_at=str(mr_data.get("created_at", "")),
                            model_id=str(mr_data.get("model_id", ""))
                            if mr_data.get("model_id")
                            else None,
                            model_name=mr_data.get("model_name"),
                            profile_id=str(mr_data.get("profile_id", ""))
                            if mr_data.get("profile_id")
                            else None,
                            profile_name=mr_data.get("profile_name"),
                            agent_id=str(mr_data.get("agent_id", ""))
                            if mr_data.get("agent_id")
                            else None,
                            agent_name=mr_data.get("agent_name"),
                            persona_id=str(mr_data.get("persona_id", ""))
                            if mr_data.get("persona_id")
                            else None,
                            persona_name=mr_data.get("persona_name"),
                            actor_type=mr_data.get("actor_type"),
                        )
                    )

        # Parse mappings
        model_mapping: dict[str, dict[str, str]] = {}
        model_mapping_data = result.get("model_mapping")
        if isinstance(model_mapping_data, str):
            model_mapping_data = json.loads(model_mapping_data)
        if isinstance(model_mapping_data, dict):
            model_mapping = model_mapping_data

        agent_mapping: dict[str, str] = {}
        agent_mapping_data = result.get("agent_mapping")
        if isinstance(agent_mapping_data, str):
            agent_mapping_data = json.loads(agent_mapping_data)
        if isinstance(agent_mapping_data, dict):
            agent_mapping = {k: str(v) for k, v in agent_mapping_data.items()}

        persona_mapping: dict[str, str] = {}
        persona_mapping_data = result.get("persona_mapping")
        if isinstance(persona_mapping_data, str):
            persona_mapping_data = json.loads(persona_mapping_data)
        if isinstance(persona_mapping_data, dict):
            persona_mapping = {k: str(v) for k, v in persona_mapping_data.items()}

        response_data = ModelRunsResponse(
            model_runs=model_runs,
            total_count=int(result.get("total_count", 0)),
            page=int(result.get("page", 1)),
            page_size=int(result.get("page_size", 50)),
            total_pages=int(result.get("total_pages", 0)),
            model_mapping=model_mapping,
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
            operation="get_model_runs",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

