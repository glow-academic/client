"""Attempt full endpoint - returns complete attempt data with all related entities."""

import json
import re
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


# Inline request/response schemas
class AttemptFullRequest(BaseModel):
    attemptId: str
    profileId: str | None = None  # Current user's profile ID for role check


# Strongly typed nested models
class AttemptItem(BaseModel):
    id: str
    createdAt: str
    simulationId: str
    infiniteMode: bool
    archived: bool
    profileId: str | None = None


class SimulationItem(BaseModel):
    id: str
    title: str
    description: str
    departmentId: str | None
    active: bool
    defaultSimulation: bool
    practiceSimulation: bool
    hintsEnabled: bool
    objectivesEnabled: bool
    inputGuardrailActive: bool
    outputGuardrailActive: bool
    imageInputActive: bool
    copyPasteAllowed: bool
    timeLimit: int | None
    rubricId: str | None
    createdAt: str
    updatedAt: str


class AttemptProfileItem(BaseModel):
    profileId: str
    attemptId: str
    active: bool


class ChatItem(BaseModel):
    id: str
    createdAt: str
    updatedAt: str
    title: str
    scenarioId: str
    parentScenarioId: str | None = None
    attemptId: str
    completed: bool
    completedAt: str | None
    traceId: str | None
    documentIds: list[str]


class ScenarioItem(BaseModel):
    id: str
    name: str
    problemStatement: str
    departmentId: str | None
    active: bool
    personaId: str | None
    personaName: str | None = None
    personaIcon: str | None = None
    personaColor: str | None = None
    createdAt: str
    updatedAt: str
    generated: bool
    defaultScenario: bool
    copyPasteAllowed: bool
    objectives: list[str] | None = None


class MessageItem(BaseModel):
    id: str
    createdAt: str
    updatedAt: str
    chatId: str
    content: str
    type: str  # "query" | "response"
    completed: bool


class HintItem(BaseModel):
    simulationMessageId: str
    hint: str
    idx: int
    createdAt: str


class HintsByMessage(BaseModel):
    messageId: str
    hints: list[HintItem]


class GradingState(BaseModel):
    achievedStandards: dict[str, bool]
    passedStandards: dict[str, bool]
    gradeDescription: str | None = None
    feedbackByStandardId: dict[str, str] | None = None


class DynamicRubric(BaseModel):
    chatId: str
    score: float
    passed: bool
    timeTaken: float
    skillScores: dict[str, float]
    skillFeedbacks: dict[str, str]
    totalPossiblePoints: float


class PreviousChat(BaseModel):
    chatId: str
    attemptId: str
    score: float | None
    passed: bool | None
    createdAt: str
    title: str
    timeTaken: float | None
    totalPossiblePoints: float | None
    percentage: float | None


class GradeItem(BaseModel):
    id: str
    createdAt: str
    simulationChatId: str
    rubricId: str
    description: str | None
    passed: bool
    score: int
    timeTaken: int | None


class ChatData(BaseModel):
    chat: ChatItem
    scenario: ScenarioItem | None
    messages: list[MessageItem]
    hints: list[HintsByMessage]
    grade: GradeItem | None = None
    gradingState: GradingState | None = None
    dynamicRubric: DynamicRubric | None = None
    previousChats: list[PreviousChat]


class ScenarioDocumentItem(BaseModel):
    document_id: str
    name: str
    type: str
    updatedAt: str
    extension: str
    scenario_ids: list[str]
    can_edit: bool
    can_delete: bool
    active: bool
    department_ids: list[str] | None
    file_path: str
    mime_type: str
    parameter_item_ids: list[str]


class StandardGroupMappingItem(BaseModel):
    name: str
    description: str
    points: float
    passPoints: float


class RubricStructure(BaseModel):
    standardGroups: dict[str, list[str]]
    standardGroupsMapping: dict[str, StandardGroupMappingItem]
    standardsMapping: dict[str, dict[str, Any]]  # Can be complex nested structure


class AllSimulationScenarioItem(BaseModel):
    id: str
    name: str
    problemStatement: str
    departmentId: str | None
    active: bool
    personaId: str | None
    createdAt: str
    updatedAt: str
    generated: bool
    defaultScenario: bool
    copyPasteAllowed: bool
    objectives: list[str] | None = None
    previousChats: list[PreviousChat] = []


class TimerItem(BaseModel):
    elapsed: int
    limit: int | None
    exceeded: bool
    formatted: str


class AggregatedResults(BaseModel):
    totalScore: float
    totalPossiblePoints: float
    percentage: float
    passed: bool
    chatsCompleted: int
    totalChats: int


class AttemptFullResponse(BaseModel):
    """Response containing complete attempt data with all nested structures."""

    attempt: AttemptItem
    simulation: SimulationItem
    attemptProfiles: list[AttemptProfileItem]
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
    allSimulationScenarios: list[AllSimulationScenarioItem]


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

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get current user's profileId from request body
        # If not provided, skip role check for backward compatibility
        current_profile_id = request.profileId
        
        sql_query = load_sql("sql/v3/attempts/get_attempt_full_complete.sql")
        sql_params = (request.attemptId,)
        result = await conn.fetchrow(sql_query, request.attemptId)

        if not result:
            raise HTTPException(
                status_code=404, detail=f"Attempt not found: {request.attemptId}"
            )

        # Parse JSONB fields from strings to Python objects
        # asyncpg returns JSONB as dict/list, but handle string case for safety
        def parse_jsonb(data: Any) -> Any:  # noqa: ANN401
            if isinstance(data, str):
                return json.loads(data)
            return data

        # Role-based restriction: check if viewing profile's role is "higher" than current user's role
        if current_profile_id:
            # Get attempt's profile role from attempt_profiles
            attempt_profiles_data = parse_jsonb(result.get("attemptProfiles", []))
            attempt_profile_id = None
            if attempt_profiles_data and isinstance(attempt_profiles_data, list):
                for ap in attempt_profiles_data:
                    if isinstance(ap, dict) and ap.get("active"):
                        attempt_profile_id = ap.get("profileId")
                        break
            
            if attempt_profile_id:
                # Get roles for comparison
                attempt_profile_role_row = await conn.fetchrow(
                    "SELECT role FROM profiles WHERE id = $1",
                    attempt_profile_id,
                )
                current_user_role_row = await conn.fetchrow(
                    "SELECT role FROM profiles WHERE id = $1",
                    current_profile_id,
                )
                
                if attempt_profile_role_row and current_user_role_row:
                    attempt_role = attempt_profile_role_row["role"]
                    current_role = current_user_role_row["role"]
                    
                    # Role hierarchy: superadmin > admin > instructional > ta > guest
                    role_hierarchy = {
                        "superadmin": 5,
                        "admin": 4,
                        "instructional": 3,
                        "ta": 2,
                        "guest": 1,
                    }
                    
                    attempt_role_level = role_hierarchy.get(attempt_role.lower(), 1)
                    current_role_level = role_hierarchy.get(current_role.lower(), 1)
                    
                    # Return 403 if viewing profile's role is higher than current user's role
                    if attempt_role_level > current_role_level:
                        raise HTTPException(
                            status_code=403,
                            detail=f"You don't have permission to view attempts from {attempt_role} users. Your role ({current_role}) is lower than the attempt owner's role.",
                        )

        # Parse JSONB fields and construct strongly typed models
        attempt_data = parse_jsonb(result["attempt"])
        simulation_data = parse_jsonb(result["simulation"])
        attempt_profiles_data = parse_jsonb(result["attemptProfiles"])
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
        all_simulation_scenarios_data = parse_jsonb(result["allSimulationScenarios"])

        # Construct strongly typed models
        attempt = AttemptItem(**attempt_data)
        simulation = SimulationItem(**simulation_data)
        attempt_profiles = [AttemptProfileItem(**ap) for ap in attempt_profiles_data]

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
            grade = (
                GradeItem(**chat_data["grade"])
                if chat_data.get("grade")
                else None
            )
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

        all_simulation_scenarios = [
            AllSimulationScenarioItem(**s) for s in all_simulation_scenarios_data
        ]

        # Access result fields defensively (asyncpg may lowercase column names)
        # Try both camelCase and snake_case versions
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

        response_data = AttemptFullResponse(
            attempt=attempt,
            simulation=simulation,
            attemptProfiles=attempt_profiles,
            chats=chats,
            scenarioDocuments=scenario_documents,
            aggregatedResults=aggregated_results,
            timer=timer,
            currentChatIndex=get_result_field("currentChatIndex", 0),
            expectedChatCount=get_result_field("expectedChatCount", 1),
            isSingleChatAttempt=get_result_field("isSingleChatAttempt", True),
            isLastAttempt=get_result_field("isLastAttempt", True),
            showResults=get_result_field("showResults", False),
            shouldShowControls=get_result_field("shouldShowControls", True),
            remainingScenariosCount=get_result_field("remainingScenariosCount", 0),
            isLastRemainingScenario=get_result_field("isLastRemainingScenario", False),
            canPickMultipleAlternatives=get_result_field("canPickMultipleAlternatives", True),
            isActive=get_result_field("isActive", True),
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
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_attempt_full",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
