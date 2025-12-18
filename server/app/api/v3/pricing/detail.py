"""Pricing run detail endpoint - POST /pricing/detail"""

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
from app.utils.sql_helper import load_sql


router = APIRouter()


# Inline request/response schemas
class PricingRunDetailRequest(BaseModel):
    """Request schema for pricing run detail."""

    runId: str


class MessageItem(BaseModel):
    """Message item schema."""

    id: str
    role: str
    content: str
    createdAt: str
    updatedAt: str
    completed: bool


class RunMetadata(BaseModel):
    """Run metadata schema."""

    id: str
    createdAt: str
    inputTokens: int
    outputTokens: int
    cachedInputTokens: int
    cost: float
    modelId: str | None = None
    agentId: str | None = None
    profileId: str | None = None
    personaId: str | None = None


class PricingRunDetailResponse(BaseModel):
    """Response schema for pricing run detail."""

    run: RunMetadata
    messages: list[MessageItem]
    modelMapping: dict[str, dict[str, str]]
    agentMapping: dict[str, str]
    profileMapping: dict[str, str]


@router.post("/detail", response_model=PricingRunDetailResponse)
async def get_pricing_run_detail(
    request_body: PricingRunDetailRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PricingRunDetailResponse:
    """Get detailed pricing run information with all messages."""
    tags = ["pricing"]  # From router tags

    # Check for cache bypass header (for hard refresh)
    bypass_cache = request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = request_body.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return PricingRunDetailResponse.model_validate(cached["data"])

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
        sql_query = load_sql("sql/v3/pricing/get_run_detail_complete.sql")
        sql_params = (request_body.runId, profile_id)

        # Execute query
        result = await conn.fetchval(sql_query, request_body.runId, profile_id)

        if not result:
            # Check if run exists but user doesn't have access
            run_exists_check = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM runs WHERE id = $1)",
                request_body.runId,
            )
            if run_exists_check:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this run. It may be restricted to other departments.",
                )
            raise HTTPException(
                status_code=404, detail=f"Run not found: {request_body.runId}"
            )

        # Parse JSONB result (may be string or dict)
        parsed_result = result
        if isinstance(parsed_result, str):
            parsed_result = json.loads(parsed_result)

        # Check if access was denied (result is null)
        if not parsed_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this run. It may be restricted to other departments.",
            )

        # Parse messages
        messages: list[MessageItem] = []
        messages_data = parsed_result.get("messages", [])
        if isinstance(messages_data, list):
            for msg in messages_data:
                messages.append(
                    MessageItem(
                        id=msg["id"],
                        role=msg["role"],
                        content=msg["content"],
                        createdAt=msg["createdAt"],
                        updatedAt=msg["updatedAt"],
                        completed=msg["completed"],
                    )
                )

        # Parse run metadata
        run_data = parsed_result.get("run", {})
        run_metadata = RunMetadata(
            id=run_data["id"],
            createdAt=run_data["createdAt"],
            inputTokens=run_data["inputTokens"],
            outputTokens=run_data["outputTokens"],
            cachedInputTokens=run_data["cachedInputTokens"],
            cost=run_data["cost"],
            modelId=run_data.get("modelId"),
            agentId=run_data.get("agentId"),
            profileId=run_data.get("profileId"),
            personaId=run_data.get("personaId"),
        )

        # Parse mappings
        model_mapping: dict[str, dict[str, str]] = {}
        model_mapping_data = parsed_result.get("modelMapping", {})
        if isinstance(model_mapping_data, str):
            model_mapping_data = json.loads(model_mapping_data)
        if model_mapping_data and isinstance(model_mapping_data, dict):
            model_mapping = model_mapping_data

        agent_mapping: dict[str, str] = {}
        agent_mapping_data = parsed_result.get("agentMapping", {})
        if isinstance(agent_mapping_data, str):
            agent_mapping_data = json.loads(agent_mapping_data)
        if agent_mapping_data and isinstance(agent_mapping_data, dict):
            agent_mapping = agent_mapping_data

        profile_mapping: dict[str, str] = {}
        profile_mapping_data = parsed_result.get("profileMapping", {})
        if isinstance(profile_mapping_data, str):
            profile_mapping_data = json.loads(profile_mapping_data)
        if profile_mapping_data and isinstance(profile_mapping_data, dict):
            profile_mapping = profile_mapping_data

        # Build response
        response_data = PricingRunDetailResponse(
            run=run_metadata,
            messages=messages,
            modelMapping=model_mapping,
            agentMapping=agent_mapping,
            profileMapping=profile_mapping,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return response_data

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        await handle_route_error(
            e,
            sql_query=sql_query,
            sql_params=sql_params,
            route_path=request.url.path,
            operation="get_pricing_run_detail",
            request=request,
        )
        raise

