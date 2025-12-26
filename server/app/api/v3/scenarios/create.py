"""Scenario create endpoint - v3 API following DHH principles."""

import json
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    CreateScenarioApiRequest,
    CreateScenarioApiResponse,
    CreateScenarioSqlParams,
    CreateScenarioSqlRow,
    load_sql_query,
)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/scenarios/create_scenario_complete.sql"


router = APIRouter()


@router.post(
    "/create",
    response_model=CreateScenarioApiResponse,
    dependencies=[
        audit_activity(
            "scenario.created",
            "{{ actor.name }} created scenario '{{ scenario.name }}'",
        )
    ],
)
async def create_scenario(
    request: CreateScenarioApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateScenarioApiResponse:
    """Create a new scenario."""
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

        # Prepare problem statement versions
        # If versions provided, ensure problem_statement is included and will be marked active
        problem_statement_versions = None
        if (
            request.problem_statement_versions
            and len(request.problem_statement_versions) > 0
        ):
            # Clean and include all versions
            versions_list = [
                v.strip() for v in request.problem_statement_versions if v and v.strip()
            ]
            # Ensure problem_statement is in the list (it will be marked active in SQL)
            if (
                request.problem_statement
                and request.problem_statement.strip() not in versions_list
            ):
                versions_list.append(request.problem_statement.strip())
            problem_statement_versions = versions_list if versions_list else None

        # Server-side validation: enforce fixed limits (server is source of truth)
        # Note: SQL handles None-to-empty conversions, so we can pass None values
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
        parameter_count = len(parameter_ids or [])
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
        objective_count = len(filtered_objective_ids or [])
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

        # Convert API request to SQL params (add profile_id from header)
        # Construct dict with preprocessed values for SQL params
        # SQL handles None-to-empty conversions via COALESCE in params CTE
        request_dict = {
            "name": request.name,
            "description": request.description,
            "active": request.active,
            "objectives_enabled": request.objectives_enabled,
            "images_enabled": request.images_enabled,
            "video_enabled": request.video_enabled,
            "questions_enabled": request.questions_enabled,
            "problem_statement_enabled": request.problem_statement_enabled,
            "video_agent_id": request.video_agent_id,
            "problem_statement": request.problem_statement,
            "problem_statement_name": request.problem_statement_name,
            "problem_statement_versions": problem_statement_versions,
            "department_ids": request.department_ids,
            "persona_ids": request.persona_ids,
            "document_ids": request.document_ids,
            "template_document_ids": request.template_document_ids,
            "objective_ids": filtered_objective_ids,
            "parameter_item_ids": parameter_item_ids,
            "upload_images_json": upload_images_json,
            "video_ids": request.video_ids,
            "active_video_id": request.active_video_id,
            "question_ids": request.question_ids,
            "question_timestamps": question_timestamps_json,
            "run_id": None,
            "parameter_ids": parameter_ids,
        }
        params = CreateScenarioSqlParams(**request_dict, profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute SQL with typed helper (single row result)
        result = cast(
            CreateScenarioSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if not result.scenario_id:
            raise ValueError("Failed to create scenario")

        scenario_id = str(result.scenario_id)
        actor_name = result.actor_name

        # Set audit context with data from SQL query
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                scenario={"name": request.name, "id": scenario_id},
            )

        result_data = CreateScenarioApiResponse(
            success=True,
            scenarioId=scenario_id,
            message=f"Scenario '{request.name}' created successfully",
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
            operation="create_scenario",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
