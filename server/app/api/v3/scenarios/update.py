"""Scenario update endpoint - v3 API following DHH principles."""

import json
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (UpdateScenarioApiRequest, UpdateScenarioApiResponse,
                           UpdateScenarioSqlParams, UpdateScenarioSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/scenarios/update_scenario_complete.sql"


# Request/response schemas will be auto-generated from SQL function signature
# Using UpdateScenarioApiRequest and UpdateScenarioApiResponse from app.sql.types


router = APIRouter()


@router.post(
    "/update",
    response_model=UpdateScenarioApiResponse,
    dependencies=[
        audit_activity(
            "scenario.updated",
            "{{ actor.name }} updated scenario '{{ scenario.name }}'",
        )
    ],
)
async def update_scenario(
    request: UpdateScenarioApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateScenarioApiResponse:
    """Update an existing scenario."""
    tags = ["scenarios"]  # From router tags

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Prepare data for consolidated SQL
        # Filter out composite objective IDs (references to existing objectives)
        filtered_objective_ids = [
            obj_id
            for obj_id in request.objective_ids
            if not ("_" in obj_id and len(obj_id.split("_")) == 2)
        ]

        # Flatten parameters dict into array of parameter_item_ids
        parameter_item_ids = [
            param_item_id
            for param_item_ids in request.parameters.values()
            for param_item_id in param_item_ids
        ]
        # Extract parameter IDs from parameters dict keys
        parameter_ids = list(request.parameters.keys()) if request.parameters else []

        # Server-side validation: enforce fixed limits (server is source of truth)
        # Personas: 1-3 (must have at least 1)
        persona_count = len(request.persona_ids or [])
        if persona_count < 1 or persona_count > 3:
            raise ValueError(
                f"Personas must be between 1 and 3. Received {persona_count}."
            )

        # Documents: 0-3
        document_count = len(request.document_ids or [])
        if document_count > 3:
            raise ValueError(
                f"Documents must be between 0 and 3. Received {document_count}."
            )

        # Parameters: 0-3
        parameter_count = len(parameter_ids)
        if parameter_count > 3:
            raise ValueError(
                f"Parameters must be between 0 and 3. Received {parameter_count}."
            )

        # Each parameter's fields: 1-3 per parameter
        for param_id, field_ids in request.parameters.items():
            field_count = len(field_ids)
            if field_count < 1 or field_count > 3:
                raise ValueError(
                    f"Fields for parameter {param_id} must be between 1 and 3. "
                    f"Received {field_count}."
                )

        # Objectives: 0-3
        objective_count = len(filtered_objective_ids)
        if objective_count > 3:
            raise ValueError(
                f"Objectives must be between 0 and 3. Received {objective_count}."
            )

        # Validate upload_ids and image_names match in length
        if len(request.upload_ids or []) != len(request.image_names or []):
            raise ValueError("upload_ids and image_names must have the same length")

        # Prepare upload images JSON (array of objects with upload_id and name)
        # Pass as dict/list so asyncpg can convert to jsonb automatically
        upload_images_json = None
        if request.upload_ids and request.image_names:
            upload_images_json = [
                {"upload_id": upload_id, "name": name}
                for upload_id, name in zip(request.upload_ids, request.image_names)
            ]

        # Prepare question timestamps JSON
        # Pass as dict so asyncpg can convert to jsonb automatically
        question_timestamps_json = request.question_timestamps

        # Validate video_agent_id is provided if video_enabled
        if request.video_enabled and not request.video_agent_id:
            raise ValueError("video_agent_id is required when video_enabled is true")

        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert API request to SQL params (use double star pattern)
        # SQL handles None-to-empty conversions via COALESCE in params CTE
        # Override fields that need preprocessing
        params = UpdateScenarioSqlParams(
            **request.model_dump(),
            profile_id=profile_id,
            scenario_id=request.scenarioId,
            objective_ids=filtered_objective_ids,
            parameter_item_ids=parameter_item_ids,
            parameter_ids=parameter_ids,
            upload_images_json=upload_images_json,
            question_timestamps=question_timestamps_json,
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper (single row result)
        result = cast(
            UpdateScenarioSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Check if scenario exists using SQL result
        if not result.scenario_exists:
            raise HTTPException(
                status_code=404, detail=f"Scenario not found: {request.scenarioId}"
            )

        scenario_id = result.scenario_id
        scenario_name = result.name
        actor_name = result.actor_name

        # Set audit context with data from SQL query
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                scenario={"name": scenario_name, "id": scenario_id},
            )

        result_data = UpdateScenarioApiResponse(
            success=True,
            message=f"Scenario '{scenario_name}' updated successfully",
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_scenario",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
