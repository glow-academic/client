"""Scenario detail endpoint - v3 API following DHH principles."""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetScenarioDetailApiRequest,
                           GetScenarioDetailApiResponse,
                           GetScenarioDetailSqlParams, GetScenarioDetailSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/scenarios/get_scenario_detail_complete.sql"


# Request model for frontend compatibility (camelCase field names)
class ScenarioDetailRequest(BaseModel):
    """Request to get scenario details - frontend uses camelCase."""

    scenarioId: str
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
    problemStatement: str | None = None
    objectives: list[str] | None = None
    name: str | None = None


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


class ScenarioDetailResponse(GetScenarioDetailApiResponse):
    """Extended response with computed fields for frontend compatibility."""

    # Computed fields not in SQL response (can_edit, can_duplicate, can_delete now come from SQL)
    allowed_ranges: AllowedRanges | None = None
    objective_count_range: RangeMinMax
    # Frontend expects these as arrays of strings (valid_field_ids, question_ids now come from SQL)
    valid_general_field_ids: list[str] | None = None
    # Frontend expects these specific field names
    images_enabled: bool | None = None
    scenario_parameter_ids: list[str] | None = None
    active_simulation_ids: list[str] | None = None


router = APIRouter()


@router.post(
    "/detail",
    response_model=ScenarioDetailResponse,
    dependencies=[
        audit_activity(
            "scenario.viewed", "{{ actor.name }} viewed scenario '{{ scenario.name }}'"
        )
    ],
)
async def get_scenario_detail(
    request_data: ScenarioDetailRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ScenarioDetailResponse:
    """Get detailed scenario information."""
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
        params = GetScenarioDetailSqlParams(
            scenario_id=uuid.UUID(request_data.scenarioId),
            profile_id=profile_id,
            use_image=request_data.useImage if request_data.useImage is not None else False,
            use_objectives=use_objectives,
            document_ids=to_uuid_list(request_data.documentIds),
            problem_statement_ids=to_uuid_list(request_data.problemStatementIds),
            template_document_ids=to_uuid_list(request_data.templateDocumentIds),
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
            GetScenarioDetailSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Check if scenario exists and has access using SQL result
        if not result.scenario_exists:
            raise HTTPException(
                status_code=404, detail=f"Scenario {request_data.scenarioId} not found"
            )
        
        if not result.scenario_id:
            # Scenario exists but user doesn't have access
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this scenario. It may be restricted to other departments.",
            )

        # Set audit context with data from SQL query
        if result.actor_name:
            audit_set(
                request,
                actor={"name": result.actor_name, "id": profile_id},
                scenario={"name": result.name or "", "id": str(result.scenario_id)},
            )

        # Use SQL-computed fields directly
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

        # Build allowed ranges from SQL-computed field_ranges
        allowed_field_ranges: dict[str, RangeMinMax] = {}
        for fr in (result.field_ranges or []):
            if fr.parameter_id:
                param_id_str = str(fr.parameter_id)
                allowed_field_ranges[param_id_str] = RangeMinMax(
                    min=max(1, min(fr.min_count or 1, 3)),
                    max=max(1, min(fr.max_count or 1, 3)),
                )
        
        # Add defaults for parameters without field ranges
        for param_id in valid_parameter_ids:
            if param_id not in allowed_field_ranges:
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

        # Convert base response from SQL result
        base_response = GetScenarioDetailApiResponse.model_validate(result.model_dump())

        # Build extended response with computed fields
        # SQL now returns can_edit, can_duplicate, can_delete, valid_field_ids, question_ids, valid_parameter_ids
        # Only add fields that aren't in base_response
        response_data = ScenarioDetailResponse(
            **base_response.model_dump(),
            allowed_ranges=allowed_ranges,
            objective_count_range=RangeMinMax(min=1, max=3),
            valid_general_field_ids=result.valid_field_ids or [],
            images_enabled=result.image_input_enabled or False,
            scenario_parameter_ids=result.parameter_ids or [],
            active_simulation_ids=result.simulation_ids or [],
        )

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump(mode='json')},
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
            operation="get_scenario_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
