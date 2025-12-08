"""Run full endpoint - returns complete run data with all related entities for evals."""

import json
import re
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

# Import shared models from attempts/full.py
from app.api.v3.attempts.full import (
    AggregatedResults,
    AllSimulationScenarioItem,
    AttemptProfileItem,
    ChatData,
    ChatItem,
    DynamicRubric,
    GradeItem,
    GradingState,
    HintsByMessage,
    MessageItem,
    PreviousChat,
    RubricStructure,
    ScenarioDocumentItem,
    ScenarioItem,
    SimulationItem,
    StandardGroupMappingItem,
    TimerItem,
)
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql

router = APIRouter()


# Inline request/response schemas
class RunFullRequest(BaseModel):
    runId: str
    profileId: str | None = None  # Current user's profile ID for role check


class RunItem(BaseModel):
    id: str
    createdAt: str
    inputTokens: int
    outputTokens: int
    cachedInputTokens: int
    keyId: str | None = None
    agentId: str | None = None


# Reuse AttemptFullResponse structure but adapt for runs
class RunFullResponse(BaseModel):
    """Response containing complete run data with all nested structures."""

    run: RunItem
    simulation: SimulationItem | None = None  # May not exist for runs
    attemptProfiles: list[AttemptProfileItem] = []  # Empty for runs
    chats: list[ChatData]
    scenarioDocuments: list[ScenarioDocumentItem]
    aggregatedResults: AggregatedResults | None = None
    timer: TimerItem
    currentChatIndex: int
    expectedChatCount: int
    isSingleChatAttempt: bool
    isLastAttempt: bool
    showResults: bool
    shouldShowControls: bool
    remainingScenariosCount: int
    isLastRemainingScenario: bool
    canPickMultipleAlternatives: bool
    isActive: bool
    rubricStructure: RubricStructure | None = None
    allSimulationScenarios: list[AllSimulationScenarioItem] = []  # Empty for runs


@router.post("/full", response_model=RunFullResponse)
async def get_run_full(
    request: RunFullRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RunFullResponse:
    """Get complete run data with all related entities and computed values."""
    tags = ["runs"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return RunFullResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/runs/get_run_full_complete.sql")
        sql_params = (request.runId,)
        result = await conn.fetchrow(sql_query, request.runId)

        if not result:
            raise HTTPException(
                status_code=404, detail=f"Run not found: {request.runId}"
            )

        # Parse JSONB fields from strings to Python objects
        def parse_jsonb(data: Any) -> Any:  # noqa: ANN401
            if isinstance(data, str):
                return json.loads(data)
            return data

        # Parse JSONB fields and construct strongly typed models
        run_data = parse_jsonb(result["run"])
        chats_data = parse_jsonb(result["chats"])
        scenario_documents_data = parse_jsonb(result["scenarioDocuments"])
        aggregated_results_data = (
            parse_jsonb(result["aggregatedResults"])
            if result.get("aggregatedResults")
            else None
        )
        timer_data = parse_jsonb(result["timer"])
        rubric_structure_data = (
            parse_jsonb(result["rubricStructure"])
            if result.get("rubricStructure")
            else None
        )

        # Construct strongly typed models
        run = RunItem(**run_data)

        # Construct chats with nested structures
        chats = []
        for chat_data in chats_data:
            chat_item = ChatItem(**chat_data["chat"])
            scenario = (
                ScenarioItem(**chat_data["scenario"])
                if chat_data.get("scenario")
                else None
            )
            messages = [MessageItem(**m) for m in chat_data.get("messages", [])]
            hints = [HintsByMessage(**h) for h in chat_data.get("hints", [])]
            grade = GradeItem(**chat_data["grade"]) if chat_data.get("grade") else None
            grading_state = (
                GradingState(**chat_data["gradingState"])
                if chat_data.get("gradingState")
                else None
            )
            dynamic_rubric = (
                DynamicRubric(**chat_data["dynamicRubric"])
                if chat_data.get("dynamicRubric")
                else None
            )
            previous_chats = [
                PreviousChat(**pc) for pc in chat_data.get("previousChats", [])
            ]

            chats.append(
                ChatData(
                    chat=chat_item,
                    scenario=scenario,
                    messages=messages,
                    hints=hints,
                    grade=grade,
                    gradingState=grading_state,
                    dynamicRubric=dynamic_rubric,
                    previousChats=previous_chats,
                )
            )

        scenario_documents = [
            ScenarioDocumentItem(**sd) for sd in scenario_documents_data
        ]
        aggregated_results = (
            AggregatedResults(**aggregated_results_data)
            if aggregated_results_data
            else None
        )
        timer = TimerItem(**timer_data)

        rubric_structure = None
        if rubric_structure_data:
            # Handle nested mappings for rubric structure
            standard_groups_mapping = {
                k: StandardGroupMappingItem(**v)
                for k, v in rubric_structure_data.get(
                    "standardGroupsMapping", {}
                ).items()
            }
            rubric_structure = RubricStructure(
                standardGroups=rubric_structure_data.get("standardGroups", {}),
                standardGroupsMapping=standard_groups_mapping,
                standardsMapping=rubric_structure_data.get("standardsMapping", {}),
            )

        # Access result fields defensively (asyncpg may lowercase column names)
        def get_result_field(key: str, default: Any = None) -> Any:  # noqa: ANN401
            """Get field from result, trying both camelCase and snake_case."""
            if key in result:
                return result[key]
            # Try lowercase version (asyncpg might lowercase)
            key_lower = key.lower()
            if key_lower in result:
                return result[key_lower]
            # Try snake_case version
            key_snake = re.sub(r"([A-Z])", r"_\1", key).lower()
            if key_snake in result:
                return result[key_snake]
            return default

        response_data = RunFullResponse(
            run=run,
            simulation=None,  # Runs don't have simulations
            attemptProfiles=[],  # Runs don't have attempt profiles
            chats=chats,
            scenarioDocuments=scenario_documents,
            aggregatedResults=aggregated_results,
            timer=timer,
            currentChatIndex=get_result_field("currentChatIndex", 0),
            expectedChatCount=get_result_field("expectedChatCount", 1),
            isSingleChatAttempt=get_result_field("isSingleChatAttempt", True),
            isLastAttempt=get_result_field("isLastAttempt", False),
            showResults=get_result_field("showResults", True),
            shouldShowControls=get_result_field("shouldShowControls", False),
            remainingScenariosCount=get_result_field("remainingScenariosCount", 0),
            isLastRemainingScenario=get_result_field("isLastRemainingScenario", False),
            canPickMultipleAlternatives=get_result_field(
                "canPickMultipleAlternatives", False
            ),
            isActive=get_result_field("isActive", False),
            rubricStructure=rubric_structure,
            allSimulationScenarios=[],  # Runs don't have simulation scenarios
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
            route_path=http_request.url.path,
            operation="get_run_full",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
