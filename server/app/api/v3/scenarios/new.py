"""Scenario new endpoint - v3 API following DHH principles."""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetScenarioNewApiRequest, GetScenarioNewApiResponse,
                           GetScenarioNewSqlParams, GetScenarioNewSqlRow,
                           QGetScenarioNewV3Agent, QGetScenarioNewV3Department,
                           QGetScenarioNewV3Document,
                           QGetScenarioNewV3DocumentDetail,
                           QGetScenarioNewV3Field, QGetScenarioNewV3Objective,
                           QGetScenarioNewV3ObjectiveWithDepartments,
                           QGetScenarioNewV3Parameter,
                           QGetScenarioNewV3ParameterDetail,
                           QGetScenarioNewV3Persona,
                           QGetScenarioNewV3ProblemStatement,
                           QGetScenarioNewV3Question,
                           QGetScenarioNewV3ScenarioImage,
                           QGetScenarioNewV3ScenarioVideo, load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/scenarios/get_scenario_new_complete.sql"


# Request model for frontend compatibility (camelCase field names)
class ScenarioNewRequest(BaseModel):
    """Request to get default scenario details - frontend uses camelCase."""

    departmentIds: list[str] | None = None
    personaIds: list[str] | None = None
    documentIds: list[str] | None = None
    templateDocumentIds: list[str] | None = None
    parameterIds: list[str] | None = None
    fieldIds: list[str] | None = None
    personaSearch: str | None = None
    documentSearch: str | None = None
    parameterSearch: str | None = None
    documentShowSelected: bool | None = None
    documentShowTemplate: bool | None = None
    personaShowSelected: bool | None = None
    parameterShowSelected: bool | None = None
    fieldShowSelectedByParam: dict[str, bool] | None = None
    personaMin: int | None = None
    personaMax: int | None = None
    documentMin: int | None = None
    documentMax: int | None = None
    parameterSelectionMin: int | None = None
    parameterSelectionMax: int | None = None
    objectivesMin: int | None = None
    objectivesMax: int | None = None
    fieldRanges: dict[str, dict[str, int]] | None = None
    useImage: bool | None = None
    useVideo: bool | None = None
    imageIds: list[str] | None = None
    objectiveIds: list[str] | None = None
    problemStatementIds: list[str] | None = None


# Response model extends auto-generated response with computed fields
class RangeMinMax(BaseModel):
    """Min/max range values."""

    min: int
    max: int


class AllowedRanges(BaseModel):
    """Allowed min/max ranges for each section."""

    persona: RangeMinMax
    document: RangeMinMax
    parameter_selection: RangeMinMax
    fields: dict[str, RangeMinMax]


class ScenarioDetailResponse(BaseModel):
    """Response for scenario new - extends auto-generated response with computed fields."""

    # Fields from GetScenarioNewApiResponse (use composite types directly)
    actor_name: str | None = None
    user_role: str | None = None
    department_ids: list[str] | None = None
    valid_persona_ids: list[str] | None = None
    valid_document_ids: list[str] | None = None
    primary_department_id: str | None = None
    scenario_agent_id: str | None = None
    image_agent_id: str | None = None
    video_agent_id: str | None = None
    valid_agent_ids: list[str] | None = None
    selected_template_document_ids: list[str] | None = None
    video_enabled: bool | None = None
    questions_enabled: bool | None = None
    persona_range_min: int | None = None
    persona_range_max: int | None = None
    document_range_min: int | None = None
    document_range_max: int | None = None
    parameter_range_min: int | None = None
    parameter_range_max: int | None = None
    question_ids: list[str] | None = None
    departments: list[QGetScenarioNewV3Department] | None = None
    personas: list[QGetScenarioNewV3Persona] | None = None
    documents: list[QGetScenarioNewV3Document] | None = None
    parameters: list[QGetScenarioNewV3Parameter] | None = None
    fields: list[QGetScenarioNewV3Field] | None = None
    agents: list[QGetScenarioNewV3Agent] | None = None
    objectives: list[QGetScenarioNewV3Objective] | None = None
    problem_statements: list[QGetScenarioNewV3ProblemStatement] | None = None
    scenario_images: list[QGetScenarioNewV3ScenarioImage] | None = None
    scenario_videos: list[QGetScenarioNewV3ScenarioVideo] | None = None
    questions: list[QGetScenarioNewV3Question] | None = None
    objectives_history: list[QGetScenarioNewV3ObjectiveWithDepartments] | None = None
    document_details: list[QGetScenarioNewV3DocumentDetail] | None = None
    parameters_detail: list[QGetScenarioNewV3ParameterDetail] | None = None

    # Computed fields not in SQL response
    name: str = ""
    problem_statement: str = ""
    problem_statement_id: str | None = None
    active: bool = True
    generated: bool = False
    hints_enabled: bool = False
    objectives_enabled: bool = True
    image_input_enabled: bool = False
    parent_scenario_id: str | None = None
    valid_department_ids: list[str] = []
    persona_ids: list[str] = []
    document_ids: list[str] = []
    objective_ids: list[str] = []
    valid_objectives: list[str] = []
    active_simulation_ids: list[str] = []
    parameters_dict: dict[str, dict[str, list[str]]] = {}  # Renamed to avoid conflict
    can_edit: bool = False
    can_duplicate: bool = False
    can_delete: bool = False
    scenario_parameter_ids: list[str] = []
    valid_parameter_ids: list[str] = []
    valid_field_ids: list[str] | None = None
    valid_general_field_ids: list[str] | None = None
    allowed_ranges: AllowedRanges | None = None
    objective_count_range: RangeMinMax = RangeMinMax(min=0, max=3)
    selected_persona_ids: list[str] | None = None
    selected_document_ids: list[str] | None = None
    selected_parameter_ids: list[str] | None = None
    selected_field_ids: list[str] | None = None
    persona_search: str | None = None
    document_search: str | None = None
    parameter_search: str | None = None
    persona_min: int | None = None
    persona_max: int | None = None
    document_min: int | None = None
    document_max: int | None = None
    parameter_selection_min: int | None = None
    parameter_selection_max: int | None = None
    field_ranges: dict[str, dict[str, int]] | None = None


router = APIRouter()


@router.post(
    "/new",
    response_model=ScenarioDetailResponse,
    dependencies=[
        audit_activity("scenario.new", "{{ actor.name }} viewed new scenario form")
    ],
)
async def get_scenario_new(
    request_data: ScenarioNewRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ScenarioDetailResponse:
    """Get default scenario structure for creation mode."""
    tags = ["scenarios"]  # From router tags

    # Check for cache bypass header (for hard refresh)
    bypass_cache = request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = request_data.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return ScenarioDetailResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert camelCase request to snake_case for SQL params
        # Convert string IDs to UUIDs where needed
        def to_uuid_list(ids: list[str] | None) -> list[uuid.UUID] | None:
            if not ids:
                return None
            try:
                return [uuid.UUID(id) for id in ids]
            except (ValueError, TypeError):
                return None

        # Derive useObjectives from objectivesMax for backward compatibility with SQL
        use_objectives = (
            request_data.objectivesMax is not None and request_data.objectivesMax > 0
        )

        # Convert API request to SQL params (use double star pattern)
        params = GetScenarioNewSqlParams(
            profile_id=uuid.UUID(profile_id),
            use_image=request_data.useImage if request_data.useImage is not None else False,
            use_objectives=use_objectives,
            document_ids=to_uuid_list(request_data.documentIds),
            problem_statement_ids=to_uuid_list(request_data.problemStatementIds),
            template_document_ids=to_uuid_list(request_data.templateDocumentIds),
            objective_ids=to_uuid_list(request_data.objectiveIds),
            image_ids=to_uuid_list(request_data.imageIds),
            use_video=request_data.useVideo if request_data.useVideo is not None else False,
            filter_department_ids=to_uuid_list(request_data.departmentIds),
            filter_persona_ids=to_uuid_list(request_data.personaIds),
            filter_document_ids=to_uuid_list(request_data.documentIds),
            filter_parameter_ids=to_uuid_list(request_data.parameterIds),
            filter_field_ids=to_uuid_list(request_data.fieldIds),
            persona_search=request_data.personaSearch,
            document_search=request_data.documentSearch,
            parameter_search=request_data.parameterSearch,
            persona_show_selected=request_data.personaShowSelected,
            document_show_selected=request_data.documentShowSelected,
            parameter_show_selected=request_data.parameterShowSelected,
            field_show_selected_by_param=request_data.fieldShowSelectedByParam,
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            GetScenarioNewSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_set(request, actor={"name": result.actor_name, "id": profile_id})

        dept_ids = result.department_ids or []
        if not dept_ids:
            raise ValueError("No accessible departments found for user")

        # Get user role and primary department for default behavior
        user_role = str(result.user_role or "").lower()
        is_superadmin = user_role == "superadmin"
        primary_department_id = result.primary_department_id

        # Set default department_ids based on role
        if is_superadmin:
            default_department_ids = None
        else:
            default_department_ids = (
                [str(primary_department_id)] if primary_department_id else []
            )

        is_default = default_department_ids is None or len(default_department_ids) == 0
        can_edit_default = not (is_default and not is_superadmin)

        # Use SQL-computed valid IDs directly
        valid_parameter_ids = result.valid_parameter_ids or []
        # Reorder valid_parameter_ids to put selected parameters first (frontend-specific)
        if request_data.parameterIds:
            selected_param_set = set(request_data.parameterIds)
            selected_params = [
                pid for pid in request_data.parameterIds if pid in valid_parameter_ids
            ]
            other_params = [
                pid for pid in valid_parameter_ids if pid not in selected_param_set
            ]
            valid_parameter_ids = selected_params + other_params

        # Build allowed ranges from SQL-computed values
        allowed_field_ranges: dict[str, RangeMinMax] = {}
        for param_id in valid_parameter_ids:
            allowed_field_ranges[param_id] = RangeMinMax(min=1, max=3)

        allowed_ranges = AllowedRanges(
            persona=RangeMinMax(
                min=result.persona_range_min or 1,
                max=result.persona_range_max or 3
            ),
            document=RangeMinMax(
                min=result.document_range_min or 0,
                max=result.document_range_max or 3
            ),
            parameter_selection=RangeMinMax(
                min=result.parameter_range_min or 0,
                max=result.parameter_range_max or 3
            ),
            fields=allowed_field_ranges,
        )

        # Filter selected IDs from request to only include valid ones (SQL returns pre-filtered arrays)
        valid_persona_ids = result.valid_persona_ids or []
        valid_document_ids = result.valid_document_ids or []
        valid_field_ids = result.valid_field_ids or []
        
        selected_persona_ids = None
        selected_document_ids = None
        selected_parameter_ids = None
        selected_field_ids = None

        if request_data.personaIds:
            selected_persona_ids = [
                pid for pid in request_data.personaIds if pid in valid_persona_ids
            ]
        if request_data.documentIds:
            selected_document_ids = [
                did for did in request_data.documentIds if did in valid_document_ids
            ]
        if request_data.parameterIds:
            selected_parameter_ids = [
                pid for pid in request_data.parameterIds if pid in valid_parameter_ids
            ]
        if request_data.fieldIds:
            selected_field_ids = [
                fid for fid in request_data.fieldIds if fid in valid_field_ids
            ]

        # Convert parameters_detail to dict format expected by frontend
        parameters_dict: dict[str, dict[str, list[str]]] = {}
        for param_detail in (result.parameters_detail or []):
            if param_detail.param_id:
                parameters_dict[str(param_detail.param_id)] = {
                    "field_ids": [str(fid) for fid in (param_detail.selected_items or []) if fid],
                    "valid_field_ids": [str(fid) for fid in (param_detail.valid_items or []) if fid],
                }

        # Use composite types directly - they serialize correctly with model_dump(mode='json')
        # Frontend should use these types directly (server is source of truth)
        # Only transform when frontend requires specific field names
        document_details_list = [
            {**doc.model_dump(mode='json'), "updatedAt": str(doc.updated_at) if doc.updated_at else ""}
            for doc in (result.document_details or [])
            if doc.document_id
        ]

        objectives_history_list = [
            obj.model_dump(mode='json')
            for obj in (result.objectives_history or [])
        ]

        # scenario_images needs 'id' field (frontend expects it)
        scenario_images_list = [
            {**img.model_dump(mode='json'), "id": str(img.upload_id) if img.upload_id else ""}
            for img in (result.scenario_images or [])
        ]

        # scenario_videos and questions can use composite types directly
        scenario_videos_list = [
            vid.model_dump(mode='json')
            for vid in (result.scenario_videos or [])
        ]

        questions_list = [
            q.model_dump(mode='json')
            for q in (result.questions or [])
        ]

        # Convert base response from SQL result
        base_response = GetScenarioNewApiResponse.model_validate(result.model_dump())
        base_dict = base_response.model_dump()
        
        # Remove fields we want to override with computed/transformed values
        fields_to_remove = [
            'department_ids',  # Override with computed default_department_ids
            'objectives_history',  # Override with transformed list
            'scenario_images',  # Override with transformed list
            'scenario_videos',  # Override with transformed list
            'questions',  # Override with transformed list
            'document_details',  # Override with transformed list
            'parameters_detail',  # Keep original but will be set explicitly
        ]
        for field in fields_to_remove:
            base_dict.pop(field, None)

        # Build extended response with computed fields
        response_data = ScenarioDetailResponse(
            **base_dict,
            name="",
            problem_statement="",
            problem_statement_id=None,
            active=True,
            generated=False,
            hints_enabled=False,
            objectives_enabled=True,
            image_input_enabled=False,
            parent_scenario_id=None,
            department_ids=default_department_ids,  # Override with computed default
            valid_department_ids=dept_ids,
            persona_ids=selected_persona_ids if selected_persona_ids else [],
            document_ids=selected_document_ids if selected_document_ids else [],
            objective_ids=[],
            valid_objectives=[],
            objectives_history=objectives_history_list,  # type: ignore
            scenario_images=scenario_images_list,  # type: ignore
            scenario_videos=scenario_videos_list,  # type: ignore
            questions=questions_list,  # type: ignore
            document_details=document_details_list,  # type: ignore
            parameters_detail=result.parameters_detail,  # Keep original composite types
            active_simulation_ids=[],
            parameters_dict=parameters_dict,  # Use renamed field for frontend compatibility
            can_edit=can_edit_default,
            can_duplicate=False,
            can_delete=False,
            scenario_parameter_ids=[],
            valid_parameter_ids=valid_parameter_ids,
            valid_field_ids=valid_field_ids,
            valid_general_field_ids=valid_field_ids,
            allowed_ranges=allowed_ranges,
            objective_count_range=RangeMinMax(min=0, max=3),
            selected_persona_ids=selected_persona_ids,
            selected_document_ids=selected_document_ids,
            selected_parameter_ids=selected_parameter_ids,
            selected_field_ids=selected_field_ids,
            persona_search=request_data.personaSearch,
            document_search=request_data.documentSearch,
            parameter_search=request_data.parameterSearch,
            persona_min=request_data.personaMin,
            persona_max=request_data.personaMax,
            document_min=request_data.documentMin,
            document_max=request_data.documentMax,
            parameter_selection_min=request_data.parameterSelectionMin,
            parameter_selection_max=request_data.parameterSelectionMax,
            field_ranges=request_data.fieldRanges,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump(mode="json")},
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
            operation="get_scenario_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
