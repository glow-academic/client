"""Attempt full endpoint - returns complete attempt data with all related entities."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.db import get_db
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class AttemptFullRequest(BaseModel):
    attemptId: str


class AttemptFullResponse(BaseModel):
    """Response containing complete attempt data with all nested structures."""
    
    attempt: dict[str, Any]
    simulation: dict[str, Any]
    attemptProfiles: list[dict[str, Any]]
    chats: list[dict[str, Any]]
    scenarioDocuments: list[dict[str, Any]]
    aggregatedResults: dict[str, Any] | None
    timer: dict[str, Any]
    currentChatIndex: int
    expectedChatCount: int
    isSingleChatAttempt: bool
    isLastAttempt: bool
    showResults: bool
    shouldShowControls: bool
    isActive: bool
    rubricStructure: dict[str, Any] | None
    allSimulationScenarios: list[dict[str, Any]]


router = APIRouter()


@router.post("/full", response_model=AttemptFullResponse)
async def get_attempt_full(
    request: AttemptFullRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AttemptFullResponse:
    """Get complete attempt data with all related entities and computed values."""
    tags = ["attempts"]  # From router tags
    
    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)
    
    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return AttemptFullResponse.model_validate(cached["data"])
    
    try:
        sql = load_sql("sql/v3/attempts/get_attempt_full_complete.sql")
        result = await conn.fetchrow(sql, request.attemptId)

        if not result:
            raise HTTPException(
                status_code=404, detail=f"Attempt not found: {request.attemptId}"
            )

        # Parse JSONB fields from strings to Python objects
        # asyncpg returns JSONB as dict/list, but handle string case for safety
        def parse_jsonb(data: Any) -> Any:
            if isinstance(data, str):
                return json.loads(data)
            return data

        attempt = parse_jsonb(result["attempt"])
        simulation = parse_jsonb(result["simulation"])
        attempt_profiles = parse_jsonb(result["attemptProfiles"])
        chats = parse_jsonb(result["chats"])
        scenario_documents = parse_jsonb(result["scenarioDocuments"])
        aggregated_results = parse_jsonb(result["aggregatedResults"]) if result.get("aggregatedResults") else None
        timer = parse_jsonb(result["timer"])
        rubric_structure = parse_jsonb(result["rubricStructure"]) if result.get("rubricStructure") else None
        all_simulation_scenarios = parse_jsonb(result["allSimulationScenarios"])

        response_data = AttemptFullResponse(
            attempt=attempt,
            simulation=simulation,
            attemptProfiles=attempt_profiles,
            chats=chats,
            scenarioDocuments=scenario_documents,
            aggregatedResults=aggregated_results,
            timer=timer,
            currentChatIndex=result["currentChatIndex"],
            expectedChatCount=result["expectedChatCount"],
            isSingleChatAttempt=result["isSingleChatAttempt"],
            isLastAttempt=result["isLastAttempt"],
            showResults=result["showResults"],
            shouldShowControls=result["shouldShowControls"],
            isActive=result["isActive"],
            rubricStructure=rubric_structure,
            allSimulationScenarios=all_simulation_scenarios,
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
        raise HTTPException(status_code=500, detail=str(e))

